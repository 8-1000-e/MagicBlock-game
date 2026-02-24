use ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY;
use ephemeral_vrf_sdk::rnd::random_bool;
use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::CustomError;

pub fn resolve_ticket(ctx: Context<ResolveTicket>, random_value: [u8; 32]) -> Result<()> 
{
    require!(ctx.accounts.pool.status == PoolStatus::PendingVrf, CustomError::PoolNotPendingVrf);
    require!(ctx.accounts.buyer.key() == ctx.accounts.pool.last_buyer, CustomError::InvalidBuyer);

    let random_bool = random_bool(&random_value);

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