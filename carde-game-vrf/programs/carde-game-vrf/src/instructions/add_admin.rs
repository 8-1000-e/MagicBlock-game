use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::CustomError;

pub fn handler(ctx: Context<AddAdmin>, new_admin: Pubkey) -> Result<()> 
{
    require!(ctx.accounts.config.admins.len() < MAX_ADMINS, CustomError::MaxAdminsReached);
    require!(ctx.accounts.config.admins.iter().all(|&admin| admin != new_admin), CustomError::AdminAlreadyExists);

    ctx.accounts.config.admins.push(new_admin);

    Ok(())
}

#[derive(Accounts)]
pub struct AddAdmin<'info>
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