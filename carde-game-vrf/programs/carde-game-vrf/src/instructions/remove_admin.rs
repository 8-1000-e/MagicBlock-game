use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::CustomError;

pub fn handler(ctx: Context<RemoveAdmin>, admin: Pubkey) -> Result<()> 
{
    require!(ctx.accounts.config.admins.iter().any(|a| *a == admin), CustomError::AdminNotFound);

    ctx.accounts.config.admins.retain(|a| *a != admin);

    Ok(())
}

#[derive(Accounts)]
pub struct RemoveAdmin<'info>
{
    #[account(mut)]
    pub super_admin: Signer<'info>,

    #[account(
        mut,
        has_one = super_admin,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
}