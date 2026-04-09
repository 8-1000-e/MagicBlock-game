use bolt_lang::*;
use bolt_lang::solana_program::{program::invoke, system_instruction};
use pool::Pool;
use shared::*;

// pub const OWNER_PUBKEY: Pubkey = Pubkey::new_from_array("0x0");

declare_id!("9As38cKdZYeMStQjfDdWgTUKTBLpxb4XUhPd6FtJhtbV");

// Args layout (raw little-endian):
//   [0..8]   prize_pool: u64
//   [8..16]  ticket_price: u64
//   [16]     total_tickets: u8
//
// Required remaining_accounts (in this order):
//   [0] creator (signer, writable) — pays SOL prize
//   [1] pool component PDA (writable) — receives SOL prize
//   [2] system_program

#[system]
pub mod create_pool {
    pub fn execute(ctx: Context<Components>, args: Vec<u8>) -> Result<Components> 
    {
        // require_key_eq!(ctx.accounts.signer.key(), OWNER_PUBKEY, CardeError::Unauthorized);
        require!(args.len() >= 17, CardeError::InvalidPrizePool);
        let prize_pool = u64::from_le_bytes(args[0..8].try_into().unwrap());
        let ticket_price = u64::from_le_bytes(args[8..16].try_into().unwrap());
        let total_tickets = args[16];

        require!(prize_pool > 0, CardeError::InvalidPrizePool);
        require!(ticket_price > 0, CardeError::InvalidTicketPrice);
        require!(total_tickets > 0, CardeError::InvalidTotalTickets);
        require!(total_tickets <= MAX_TICKETS, CardeError::TooManyTickets);

        let p = &mut ctx.accounts.pool;
        let caller = p.bolt_metadata.authority;
        p.creator = caller;
        p.prize_pool = prize_pool;
        p.total_tickets = total_tickets;
        p.ticket_left = total_tickets;
        p.ticket_price = ticket_price;
        p.status = STATUS_OPEN;
        p.last_buyer = Pubkey::default();
        p.winner = Pubkey::default();
        p.winner_set = 0;
        p.created_at = Clock::get()?.unix_timestamp;
        p.closed_at = 0;

        // Pull SOL from creator → pool PDA.
        let rem = ctx.remaining_accounts;
        require!(rem.len() >= 3, CardeError::InvalidPrizePool);
        let creator_ai = &rem[0];
        let pool_ai = &rem[1];
        let system_program_ai = &rem[2];
        require_keys_eq!(*pool_ai.key, p.key(), CardeError::InvalidPrizePool);

        let ix = system_instruction::transfer(creator_ai.key, pool_ai.key, prize_pool);
        invoke(
            &ix,
            &[creator_ai.clone(), pool_ai.clone(), system_program_ai.clone()],
        )?;

        Ok(ctx.accounts)
    }

    #[system_input]
    pub struct Components {
        pub pool: Pool,
    }
}
