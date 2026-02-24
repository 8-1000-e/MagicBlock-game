use anchor_lang::prelude::*;

#[event]
pub struct PoolCreated
{
    pub pool_id: u64,
    pub creator: Pubkey,
    pub prize_pool: u64,
    pub ticket_price: u64,
    pub total_tickets: u8,
}

#[event]
pub struct TicketBought
{
    pub pool_id: u64,
    pub buyer: Pubkey,
    pub price_paid: u64,
    pub tickets_left: u8,
}

#[event]
pub struct TicketResolved
{
    pub pool_id: u64,
    pub buyer: Pubkey,
    pub won: bool,
    pub prize: u64,
}

#[event]
pub struct PoolCancelled
{
    pub pool_id: u64,
    pub creator: Pubkey,
    pub refunded: u64,
}
