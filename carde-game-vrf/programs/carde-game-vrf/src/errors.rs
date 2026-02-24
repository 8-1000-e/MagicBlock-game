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
}
