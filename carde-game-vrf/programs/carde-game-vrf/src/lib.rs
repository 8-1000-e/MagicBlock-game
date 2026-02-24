use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("9As38cKdZYeMStQjfDdWgTUKTBLpxb4XUhPd6FtJhtbQ");

#[program]
pub mod carde_game_vrf {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    pub fn add_admin(ctx: Context<AddAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::add_admin::handler(ctx, new_admin)
    }

    pub fn remove_admin(ctx: Context<RemoveAdmin>, admin: Pubkey) -> Result<()> {
        instructions::remove_admin::handler(ctx, admin)
    }

    pub fn create_pool(
        ctx: Context<CreatePool>,
        prize_pool: u64,
        ticket_price: u64,
        total_tickets: u16,
    ) -> Result<()> {
        instructions::create_pool::handler(ctx, prize_pool, ticket_price, total_tickets)
    }

    pub fn buy_ticket(ctx: Context<BuyTicket>) -> Result<()> {
        instructions::buy_ticket::handler(ctx)
    }

    pub fn resolve_ticket(ctx: Context<ResolveTicket>, randomness: Vec<u8>) -> Result<()> {
        instructions::resolve_ticket::handler(ctx, randomness)
    }

    pub fn close_pool(ctx: Context<ClosePool>) -> Result<()> {
        instructions::close_pool::handler(ctx)
    }
}
