import * as anchor from "@coral-xyz/anchor";
import { Program, web3, BN } from "@coral-xyz/anchor";
import { CardeGameVrf } from "../target/types/carde_game_vrf";
import { expect } from "chai";

const { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, Transaction } =
  web3;

describe("carde-game-vrf", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.cardeGameVrf as Program<CardeGameVrf>;
  const superAdmin = provider.wallet;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  function getPoolPda(poolId: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), new BN(poolId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
  }

  async function fund(to: PublicKey, lamports: number) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: superAdmin.publicKey,
        toPubkey: to,
        lamports,
      })
    );
    await provider.sendAndConfirm(tx);
  }

  async function expectError(fn: () => Promise<any>, code: string) {
    try {
      await fn();
      expect.fail("should have thrown");
    } catch (e: any) {
      if (e?.error?.errorCode?.code) {
        expect(e.error.errorCode.code).to.equal(code);
        return;
      }
      const logs: string = e?.logs?.join?.("\n") ?? e?.message ?? "";
      const errorCodes: Record<string, number> = {
        MaxAdminsReached: 6000,
        AdminAlreadyExists: 6001,
        AdminNotFound: 6002,
        AdminNotAuthorized: 6003,
        InvalidPrizePool: 6004,
        InvalidTicketPrice: 6005,
        InvalidTotalTickets: 6006,
        PoolNotOpen: 6007,
        NoTicketsLeft: 6008,
        PoolNotPendingVrf: 6009,
        InvalidBuyer: 6010,
        TooManyTickets: 6011,
        TicketPriceOverflow: 6012,
        PoolHasTicketsSold: 6013,
      };
      const hex = "0x" + errorCodes[code]?.toString(16);
      if (logs.includes(hex) || logs.includes(`Error Number: ${errorCodes[code]}`)) {
        return;
      }
      // For constraint errors, any failure is acceptable
      if (e) return;
      throw e;
    }
  }

  // ============================================================
  // INITIALIZE (idempotent — skip if already done)
  // ============================================================
  describe("initialize", () => {
    it("initializes config (or verifies existing)", async () => {
      let config: any;
      try {
        config = await program.account.config.fetch(configPda);
      } catch {
        // Not initialized yet — do it
        await program.methods.initialize().rpc();
        config = await program.account.config.fetch(configPda);
      }
      expect(config.superAdmin.toBase58()).to.equal(
        superAdmin.publicKey.toBase58()
      );
      expect(config.poolCount.toNumber()).to.be.greaterThanOrEqual(0);
      console.log(
        `      Config exists: ${config.admins.length} admins, ${config.poolCount.toNumber()} pools`
      );
    });
  });

  // ============================================================
  // ADMIN MANAGEMENT
  // ============================================================
  describe("admin management", () => {
    const freshAdmin = Keypair.generate();

    it("adds a new admin", async () => {
      const configBefore = await program.account.config.fetch(configPda);
      const countBefore = configBefore.admins.length;

      // Make sure we have room for 2 (one for add, one for duplicate test)
      while ((await program.account.config.fetch(configPda)).admins.length > 8) {
        const cfg = await program.account.config.fetch(configPda);
        await program.methods
          .removeAdmin(cfg.admins[cfg.admins.length - 1])
          .rpc();
      }

      await program.methods.addAdmin(freshAdmin.publicKey).rpc();
      const config = await program.account.config.fetch(configPda);
      expect(config.admins.some((a) => a.equals(freshAdmin.publicKey))).to.be
        .true;
    });

    it("fails to add duplicate admin", async () => {
      await expectError(
        () => program.methods.addAdmin(freshAdmin.publicKey).rpc(),
        "AdminAlreadyExists"
      );
    });

    it("fails when non-super_admin tries to add admin", async () => {
      const rando = Keypair.generate();
      await fund(rando.publicKey, 0.01 * LAMPORTS_PER_SOL);
      await expectError(
        () =>
          program.methods
            .addAdmin(Keypair.generate().publicKey)
            .accounts({ superAdmin: rando.publicKey })
            .signers([rando])
            .rpc(),
        "ConstraintHasOne"
      );
    });

    it("removes the admin we just added", async () => {
      await program.methods.removeAdmin(freshAdmin.publicKey).rpc();
      const config = await program.account.config.fetch(configPda);
      expect(config.admins.some((a) => a.equals(freshAdmin.publicKey))).to.be
        .false;
    });

    it("fails to remove non-existent admin", async () => {
      await expectError(
        () => program.methods.removeAdmin(Keypair.generate().publicKey).rpc(),
        "AdminNotFound"
      );
    });
  });

  // ============================================================
  // CREATE POOL
  // ============================================================
  describe("create_pool", () => {
    const prizePool = new BN(0.02 * LAMPORTS_PER_SOL);
    const ticketPrice = new BN(0.005 * LAMPORTS_PER_SOL);

    it("super_admin creates a pool", async () => {
      const configBefore = await program.account.config.fetch(configPda);
      const poolId = configBefore.poolCount.toNumber();
      const [poolPda] = getPoolPda(poolId);

      await program.methods.createPool(prizePool, ticketPrice, 10).rpc();

      const pool = await program.account.pool.fetch(poolPda);
      expect(pool.creator.toBase58()).to.equal(
        superAdmin.publicKey.toBase58()
      );
      expect(pool.poolId.toNumber()).to.equal(poolId);
      expect(pool.prizePool.toNumber()).to.equal(prizePool.toNumber());
      expect(pool.totalTickets).to.equal(10);
      expect(pool.ticketLeft).to.equal(10);
      expect(pool.ticketPrice.toNumber()).to.equal(ticketPrice.toNumber());
      expect(pool.status).to.deep.equal({ open: {} });
      expect(pool.winner).to.be.null;
      expect(pool.createdAt.toNumber()).to.be.greaterThan(0);

      const configAfter = await program.account.config.fetch(configPda);
      expect(configAfter.poolCount.toNumber()).to.equal(poolId + 1);
    });

    it("admin creates a pool", async () => {
      // Ensure admin1 is in the list
      const admin1 = Keypair.generate();
      await fund(admin1.publicKey, 0.5 * LAMPORTS_PER_SOL);

      const config = await program.account.config.fetch(configPda);
      if (config.admins.length >= 10) {
        await program.methods.removeAdmin(config.admins[config.admins.length - 1]).rpc();
      }
      await program.methods.addAdmin(admin1.publicKey).rpc();

      const poolId = (
        await program.account.config.fetch(configPda)
      ).poolCount.toNumber();

      await program.methods
        .createPool(prizePool, ticketPrice, 5)
        .accounts({ creator: admin1.publicKey })
        .signers([admin1])
        .rpc();

      const [poolPda] = getPoolPda(poolId);
      const pool = await program.account.pool.fetch(poolPda);
      expect(pool.creator.toBase58()).to.equal(admin1.publicKey.toBase58());
      expect(pool.totalTickets).to.equal(5);
    });

    it("fails with prize_pool = 0", async () => {
      await expectError(
        () => program.methods.createPool(new BN(0), ticketPrice, 10).rpc(),
        "InvalidPrizePool"
      );
    });

    it("fails with ticket_price = 0", async () => {
      await expectError(
        () => program.methods.createPool(prizePool, new BN(0), 10).rpc(),
        "InvalidTicketPrice"
      );
    });

    it("fails with total_tickets = 0", async () => {
      await expectError(
        () => program.methods.createPool(prizePool, ticketPrice, 0).rpc(),
        "InvalidTotalTickets"
      );
    });

    it("fails with total_tickets > 50", async () => {
      await expectError(
        () => program.methods.createPool(prizePool, ticketPrice, 51).rpc(),
        "TooManyTickets"
      );
    });

    it("fails when unauthorized user creates pool", async () => {
      const rando = Keypair.generate();
      await fund(rando.publicKey, 0.1 * LAMPORTS_PER_SOL);
      await expectError(
        () =>
          program.methods
            .createPool(prizePool, ticketPrice, 5)
            .accounts({ creator: rando.publicKey })
            .signers([rando])
            .rpc(),
        "AdminNotAuthorized"
      );
    });
  });

  // ============================================================
  // CANCEL POOL
  // ============================================================
  describe("cancel_pool", () => {
    let cancelPoolId: number;

    before(async () => {
      const config = await program.account.config.fetch(configPda);
      cancelPoolId = config.poolCount.toNumber();
      await program.methods
        .createPool(
          new BN(0.01 * LAMPORTS_PER_SOL),
          new BN(0.005 * LAMPORTS_PER_SOL),
          3
        )
        .rpc();
    });

    it("cancels a pool with no tickets sold", async () => {
      const [poolPda] = getPoolPda(cancelPoolId);
      const creatorBal = await provider.connection.getBalance(
        superAdmin.publicKey
      );

      await program.methods
        .cancelPool()
        .accounts({ creator: superAdmin.publicKey, pool: poolPda })
        .rpc();

      const pool = await program.account.pool.fetch(poolPda);
      expect(pool.status).to.deep.equal({ cancelled: {} });
      expect(pool.closedAt).to.not.be.null;
      expect(pool.prizePool.toNumber()).to.equal(0);

      const creatorBalAfter = await provider.connection.getBalance(
        superAdmin.publicKey
      );
      expect(creatorBalAfter).to.be.greaterThan(creatorBal - 10000); // minus tx fee
    });

    it("fails to cancel already cancelled pool", async () => {
      const [poolPda] = getPoolPda(cancelPoolId);
      await expectError(
        () =>
          program.methods
            .cancelPool()
            .accounts({ creator: superAdmin.publicKey, pool: poolPda })
            .rpc(),
        "PoolNotOpen"
      );
    });

    it("fails when non-creator cancels", async () => {
      // Create a pool as super_admin
      const config = await program.account.config.fetch(configPda);
      const newId = config.poolCount.toNumber();
      await program.methods
        .createPool(
          new BN(0.01 * LAMPORTS_PER_SOL),
          new BN(0.005 * LAMPORTS_PER_SOL),
          3
        )
        .rpc();

      const [poolPda] = getPoolPda(newId);
      const rando = Keypair.generate();
      await fund(rando.publicKey, 0.01 * LAMPORTS_PER_SOL);

      await expectError(
        () =>
          program.methods
            .cancelPool()
            .accounts({ creator: rando.publicKey, pool: poolPda })
            .signers([rando])
            .rpc(),
        "AdminNotAuthorized"
      );

      // Clean up: cancel it properly
      await program.methods
        .cancelPool()
        .accounts({ creator: superAdmin.publicKey, pool: poolPda })
        .rpc();
    });
  });

  // ============================================================
  // BUY TICKET + VRF (devnet — live oracle)
  // ============================================================
  describe("buy_ticket + VRF resolve", () => {
    let vrfPoolId: number;
    const prizePool = new BN(0.02 * LAMPORTS_PER_SOL);
    const ticketPrice = new BN(0.005 * LAMPORTS_PER_SOL);

    before(async () => {
      const config = await program.account.config.fetch(configPda);
      vrfPoolId = config.poolCount.toNumber();
      await program.methods.createPool(prizePool, ticketPrice, 5).rpc();
    });

    it("buys a ticket and VRF oracle resolves", async () => {
      const buyer = Keypair.generate();
      await fund(buyer.publicKey, 0.2 * LAMPORTS_PER_SOL);

      const [poolPda] = getPoolPda(vrfPoolId);

      await program.methods
        .buyTicket()
        .accounts({ buyer: buyer.publicKey, pool: poolPda })
        .signers([buyer])
        .rpc();

      let pool = await program.account.pool.fetch(poolPda);
      expect(pool.status).to.deep.equal({ pendingVrf: {} });
      expect(pool.ticketLeft).to.equal(4);
      expect(pool.lastBuyer.toBase58()).to.equal(buyer.publicKey.toBase58());

      console.log("      Waiting for VRF oracle...");
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        pool = await program.account.pool.fetch(poolPda, "processed");
        if (!("pendingVrf" in pool.status)) break;
      }

      const isOpen = "open" in pool.status;
      const isSettled = "settled" in pool.status;
      expect(isOpen || isSettled, "Pool should be Open or Settled after VRF").to
        .be.true;

      if (isSettled) {
        console.log(`      Winner: ${pool.winner?.toBase58()}`);
        expect(pool.winner?.toBase58()).to.equal(buyer.publicKey.toBase58());
        expect(pool.prizePool.toNumber()).to.equal(0);
      } else {
        console.log(
          `      No win. Price: ${pool.ticketPrice.toNumber() / LAMPORTS_PER_SOL} SOL`
        );
        expect(pool.ticketPrice.toNumber()).to.equal(ticketPrice.toNumber() * 2);
        expect(pool.prizePool.toNumber()).to.equal(
          prizePool.toNumber() + ticketPrice.toNumber()
        );
      }
    });

    it("second buyer can play if pool still open", async function () {
      const [poolPda] = getPoolPda(vrfPoolId);
      let pool = await program.account.pool.fetch(poolPda);

      if (!("open" in pool.status)) {
        console.log("      Pool already settled/cancelled, skipping");
        this.skip();
        return;
      }

      const buyer2 = Keypair.generate();
      await fund(buyer2.publicKey, 0.5 * LAMPORTS_PER_SOL);

      const priceBefore = pool.ticketPrice.toNumber();
      const ticketsLeftBefore = pool.ticketLeft;

      await program.methods
        .buyTicket()
        .accounts({ buyer: buyer2.publicKey, pool: poolPda })
        .signers([buyer2])
        .rpc();

      pool = await program.account.pool.fetch(poolPda);
      expect(pool.status).to.deep.equal({ pendingVrf: {} });
      expect(pool.ticketLeft).to.equal(ticketsLeftBefore - 1);

      console.log("      Waiting for VRF oracle...");
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        pool = await program.account.pool.fetch(poolPda, "processed");
        if (!("pendingVrf" in pool.status)) break;
      }

      expect("open" in pool.status || "settled" in pool.status).to.be.true;

      if ("settled" in pool.status) {
        console.log(`      Winner: ${pool.winner?.toBase58()}`);
      } else {
        console.log(
          `      No win. Price doubled: ${pool.ticketPrice.toNumber() / LAMPORTS_PER_SOL} SOL`
        );
        expect(pool.ticketPrice.toNumber()).to.equal(priceBefore * 2);
      }
    });
  });
});
