use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;

pub fn _initalize(ctx: Context<Initialize>) -> Result<()> 
{
    ctx.accounts.config.super_admin = ctx.accounts.super_admin.key();
    ctx.accounts.config.bump = *ctx.bumps;

    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info>
{
    #[account(mut)]
    pub super_admin: Signer<'info>,

    #[account(
        init,
        payer = super_admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}