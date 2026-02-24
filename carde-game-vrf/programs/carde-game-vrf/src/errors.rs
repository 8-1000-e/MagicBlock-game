use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Maximum number of admins reached")]
    MaxAdminsReached,
    #[msg("Admin already exists")]
    AdminAlreadyExists,
    #[msg("Admin not found")]
    AdminNotFound,
    #[msg("Admin not authorized")]
    AdminNotAuthorized,
    #[msg("Invalid prize pool amount")]
    InvalidPrizePool,
    #[msg("Invalid ticket price")]
    InvalidTicketPrice,
    #[msg("Invalid total tickets")]
    InvalidTotalTickets,
    #[msg("Pool is not open")]
    PoolNotOpen,
    #[msg("No tickets left")]
    NoTicketsLeft,
    #[msg("Pool is pending VRF")]
    PoolNotPendingVrf,
    #[msg("Invalid buyer")]
    InvalidBuyer,
    #[msg("Too many tickets (max 50)")]
    TooManyTickets,
    #[msg("Ticket price overflow")]
    TicketPriceOverflow,
    #[msg("Cannot cancel pool with tickets sold")]
    PoolHasTicketsSold,
}
