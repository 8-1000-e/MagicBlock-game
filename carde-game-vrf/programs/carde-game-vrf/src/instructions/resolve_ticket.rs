use ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY;
use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::CustomError;
use crate::events::TicketResolved;

pub fn handler(ctx: Context<ResolveTicket>, random_value: [u8; 32]) -> Result<()> 
{
    require!(ctx.accounts.pool.status == PoolStatus::PendingVrf, CustomError::PoolNotPendingVrf);
    require!(ctx.accounts.buyer.key() == ctx.accounts.pool.last_buyer, CustomError::InvalidBuyer);

    // Convertir les 8 premiers bytes du random en u64
    let random_number = u64::from_le_bytes(random_value[..8].try_into().unwrap());

    // Nombre de tickets au moment de l'achat
    let odds = (ctx.accounts.pool.ticket_left as u64) + 1;

    // Si le dernier ticket (ticket_left == 0), win auto
    // Sinon, 1 chance sur odds
    let win = ctx.accounts.pool.ticket_left == 0 || random_number % odds == 0;
    let mut prize_amount: u64 = 0;
    if win
    {
        ctx.accounts.pool.winner = Some(ctx.accounts.buyer.key());
        ctx.accounts.pool.status = PoolStatus::Settled;
        ctx.accounts.pool.closed_at = Some(Clock::get()?.unix_timestamp);

        // Send only the prize_pool amount to winner (keep rent in PDA)
        prize_amount = ctx.accounts.pool.prize_pool;
        ctx.accounts.pool.sub_lamports(prize_amount)?;
        ctx.accounts.buyer.add_lamports(prize_amount)?;
        ctx.accounts.pool.prize_pool = 0;
    }
    else
    {
        ctx.accounts.pool.status = PoolStatus::Open;
        ctx.accounts.pool.prize_pool += ctx.accounts.pool.ticket_price;
        ctx.accounts.pool.ticket_price = ctx.accounts.pool.ticket_price.saturating_mul(2);
    }

    emit!(TicketResolved 
    {
        pool_id: ctx.accounts.pool.pool_id,
        buyer: ctx.accounts.buyer.key(),
        won: win,
        prize: prize_amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ResolveTicket<'info>
{
    #[account(address = VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,

    #[account(
        mut,
        seeds = [POOL_SEED, pool.pool_id.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    /// CHECK: The buyer
    #[account(mut)]
    pub buyer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}