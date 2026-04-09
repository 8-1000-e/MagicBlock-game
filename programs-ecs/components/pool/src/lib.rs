use bolt_lang::*;
use ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY;
use shared::*;

declare_id!("9As38cKdZYeMStQjfDdWgTUKTBLpxb4XUhPd6FtJhtbQ");

// We hand-write the `#[bolt_program(Pool)]` block (instead of `#[component]`)
// so that we can ADD a custom instruction `vrf_callback_resolve_ticket` next
// to the macro-generated initialize/update/destroy.
//
// This works because the pool component program is the OWNER of the Pool PDA,
// so a custom instruction in this same program can mutate the PDA freely
// (no World caller-check on this code path).
//
// `#[delegate(Pool)]` enables delegate/undelegate for ER (driven from front-end).

#[delegate(Pool)]
#[bolt_program(Pool)]
pub mod pool {
    use super::*;

    /// VRF callback. Called by the Ephemeral VRF program after a randomness
    /// request issued from the `buy-ticket` system. The signer is the VRF
    /// program identity.
    pub fn vrf_callback_resolve_ticket(
        ctx: Context<VrfCallbackResolveTicket>,
        randomness: [u8; 32],
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(pool.status == STATUS_PENDING_VRF, CardeError::PoolNotPendingVrf);
        require_keys_eq!(
            ctx.accounts.buyer.key(),
            pool.last_buyer,
            CardeError::InvalidBuyer
        );

        // Random win logic: 1/odds chance, where odds = ticket_left + 1.
        // Last ticket auto-wins (kept for parity with the original program).
        let random_number = u64::from_le_bytes(randomness[..8].try_into().unwrap());
        let odds = (pool.ticket_left as u64) + 1;
        let win = pool.ticket_left == 0 || random_number % odds == 0;

        if win {
            pool.winner = ctx.accounts.buyer.key();
            pool.winner_set = 1;
            pool.status = STATUS_SETTLED;
            pool.closed_at = Clock::get()?.unix_timestamp;

            // Pay out only the prize_pool, keep rent in the PDA.
            // Use saturating math on lamports — never let the callback fail
            // and lock the pool forever.
            let prize = pool.prize_pool;
            let pool_ai = pool.to_account_info();
            let from_lamports = pool_ai.lamports();
            let payable = prize.min(from_lamports);
            **pool_ai.try_borrow_mut_lamports()? = from_lamports.saturating_sub(payable);
            **ctx.accounts.buyer.try_borrow_mut_lamports()? = ctx
                .accounts
                .buyer
                .lamports()
                .saturating_add(payable);
            pool.prize_pool = 0;
        } else {
            pool.status = STATUS_OPEN;
            pool.prize_pool = pool.prize_pool.saturating_add(pool.ticket_price);
            pool.ticket_price = pool.ticket_price.saturating_mul(2);
        }

        Ok(())
    }
}

// We do NOT use `#[component]` here because that macro generates its own
// `#[bolt_program(Pool)] pub mod pool { use super::*; }`, which would
// conflict with the manual `#[bolt_program(Pool)]` block above. Instead
// we replicate manually what `#[component]` does:
//   1. attach `#[account]` and `#[derive(InitSpace)]`
//   2. add a `bolt_metadata: BoltMetadata` field
//   3. impl `ComponentTraits` for the struct
#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub creator: Pubkey,
    pub prize_pool: u64,
    pub total_tickets: u8,
    pub ticket_left: u8,
    pub ticket_price: u64,
    pub status: u8,
    pub last_buyer: Pubkey,
    pub winner: Pubkey,
    pub winner_set: u8,
    pub created_at: i64,
    pub closed_at: i64,
    pub bolt_metadata: BoltMetadata,
}

impl ComponentTraits for Pool {
    fn seed() -> &'static [u8] { b"pool" }
    fn size() -> usize { 8 + Pool::INIT_SPACE }
}

impl Default for Pool {
    fn default() -> Self {
        Self {
            creator: Pubkey::default(),
            prize_pool: 0,
            total_tickets: 0,
            ticket_left: 0,
            ticket_price: 0,
            status: STATUS_OPEN,
            last_buyer: Pubkey::default(),
            winner: Pubkey::default(),
            winner_set: 0,
            created_at: 0,
            closed_at: 0,
            bolt_metadata: BoltMetadata::default(),
        }
    }
}

#[derive(Accounts)]
pub struct VrfCallbackResolveTicket<'info> {
    /// VRF program identity — only the Ephemeral VRF program can sign here.
    #[account(address = VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,

    /// The pool component PDA. Owned by THIS program, so direct mutation
    /// is allowed (no World caller-check needed on this custom path).
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    /// CHECK: buyer who initiated the buy_ticket call. Must equal pool.last_buyer.
    #[account(mut)]
    pub buyer: AccountInfo<'info>,
}
