use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Pool
{
    pub creator: Pubkey,
    pub pool_id: u64,
    pub prize_pool: u64,
    pub total_tickets: u16,
    pub ticket_left: u16,
    pub ticket_price: u64,
    pub status: PoolStatus,
    pub last_buyer: Pubkey,
    pub winner: Option<Pubkey>,
    pub bump: u8,
    pub created_at: i64,
    pub closed_at: Option<i64>,
}

#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PoolStatus
{
    Open,
    PendingVrf,
    Settled,
    Cancelled,
}
