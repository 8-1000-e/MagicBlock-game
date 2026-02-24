use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::CustomError;

pub fn handler(ctx: Context<CreatePool>, prize_pool: u64, ticket_price: u64, total_tickets: u16) -> Result<()> 
{
    require!(ctx.accounts.config.admins.iter().any(|a| *a == ctx.accounts.creator.key()), CustomError::AdminNotAuthorized);
    require!(prize_pool > 0, CustomError::InvalidPrizePool);
    require!(ticket_price > 0, CustomError::InvalidTicketPrice);
    require!(total_tickets > 0, CustomError::InvalidTotalTickets);

    ctx.accounts.pool.creator = ctx.accounts.creator.key();
    ctx.accounts.pool.pool_id = ctx.accounts.config.pool_count;
    ctx.accounts.pool.prize_pool = prize_pool;
    ctx.accounts.pool.total_tickets = total_tickets;
    ctx.accounts.pool.ticket_left = total_tickets;
    ctx.accounts.pool.ticket_price = ticket_price;
    ctx.accounts.pool.status = PoolStatus::Open;
    ctx.accounts.pool.last_buyer = Pubkey::default();
    ctx.accounts.pool.winner = None;
    ctx.accounts.pool.bump = ctx.bumps.pool;
    ctx.accounts.pool.created_at = Clock::get()?.unix_timestamp;
    ctx.accounts.pool.closed_at = None;

    ctx.accounts.config.pool_count += 1;

    //transfer SOL from creator to pool account
    let cpi_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.creator.to_account_info(),
        to: ctx.accounts.pool.to_account_info(),
    };
    let cpi_context = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
    anchor_lang::system_program::transfer(cpi_context, prize_pool)?;

    Ok(())
}


#[derive(Accounts)]
pub struct CreatePool<'info>
{
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Pool::INIT_SPACE,
        seeds = [POOL_SEED, config.pool_count.to_le_bytes().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}