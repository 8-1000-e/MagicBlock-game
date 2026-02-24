use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::CustomError;
use crate::events::PoolCancelled;

pub fn handler(ctx: Context<CancelPool>) -> Result<()>
{
    require!(ctx.accounts.pool.status == PoolStatus::Open, CustomError::PoolNotOpen);
    require!(ctx.accounts.pool.creator == ctx.accounts.creator.key(), CustomError::AdminNotAuthorized);
    require!(ctx.accounts.pool.ticket_left == ctx.accounts.pool.total_tickets, CustomError::PoolHasTicketsSold);

    // Refund remaining prize_pool to creator
    let amount = ctx.accounts.pool.prize_pool;
    if amount > 0 
    {
        ctx.accounts.pool.sub_lamports(amount)?;
        ctx.accounts.creator.add_lamports(amount)?;
        ctx.accounts.pool.prize_pool = 0;
    }

    ctx.accounts.pool.status = PoolStatus::Cancelled;
    ctx.accounts.pool.closed_at = Some(Clock::get()?.unix_timestamp);

    emit!(PoolCancelled 
    {
        pool_id: ctx.accounts.pool.pool_id,
        creator: ctx.accounts.creator.key(),
        refunded: amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CancelPool<'info>
{
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [POOL_SEED, pool.pool_id.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,
}
