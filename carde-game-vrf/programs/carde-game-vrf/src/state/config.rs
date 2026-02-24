use anchor_lang::prelude::*;
use crate::constants::MAX_ADMINS;

#[account]
#[derive(InitSpace)]
pub struct Config
{
    pub super_admin: Pubkey,
    #[max_len(MAX_ADMINS)]
    pub admins: Vec<Pubkey>,
    pub bump: u8,
}