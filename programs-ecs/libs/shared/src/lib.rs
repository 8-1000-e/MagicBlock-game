use bolt_lang::*;

// ─── Constants ───
pub const MAX_TICKETS: u8 = 50;

// Pool status (kept as u8 for component-friendly POD layout)
pub const STATUS_OPEN: u8 = 0;
pub const STATUS_PENDING_VRF: u8 = 1;
pub const STATUS_SETTLED: u8 = 2;

// ─── Errors ───
#[error_code]
pub enum CardeError {
    #[msg("Pool is not open")]
    PoolNotOpen,
    #[msg("No tickets left in this pool")]
    NoTicketsLeft,
    #[msg("Pool is not pending VRF")]
    PoolNotPendingVrf,
    #[msg("Buyer mismatch with last_buyer")]
    InvalidBuyer,
    #[msg("Invalid prize pool")]
    InvalidPrizePool,
    #[msg("Invalid ticket price")]
    InvalidTicketPrice,
    #[msg("Invalid total tickets")]
    InvalidTotalTickets,
    #[msg("Too many tickets requested")]
    TooManyTickets,
}
