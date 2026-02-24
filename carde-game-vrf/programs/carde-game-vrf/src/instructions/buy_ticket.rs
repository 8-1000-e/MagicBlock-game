use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::CustomError;
use crate::events::TicketBought;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use crate::instruction::ResolveTicket;


pub fn handler(ctx: Context<BuyTicket>) -> Result<()> 
{
    require!(ctx.accounts.pool.status == PoolStatus::Open, CustomError::PoolNotOpen);
    require!(ctx.accounts.pool.ticket_left > 0, CustomError::NoTicketsLeft);
    
    //transfer SOL from buyer to pool account
    let cpi_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.buyer.to_account_info(),
        to: ctx.accounts.pool.to_account_info(),
    };
    let cpi_context = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
    anchor_lang::system_program::transfer(cpi_context, ctx.accounts.pool.ticket_price)?;
    
    ctx.accounts.pool.ticket_left -= 1;
    
    ctx.accounts.pool.last_buyer = ctx.accounts.buyer.key();
    
    emit!(TicketBought 
    {
        pool_id: ctx.accounts.pool.pool_id,
        buyer: ctx.accounts.buyer.key(),
        price_paid: ctx.accounts.pool.ticket_price,
        tickets_left: ctx.accounts.pool.ticket_left,
    });

    //VRF
    ctx.accounts.pool.status = PoolStatus::PendingVrf;
    let callback_accounts = vec![
        SerializableAccountMeta { pubkey: ctx.accounts.pool.key(), is_signer: false, is_writable: true },
        SerializableAccountMeta { pubkey: ctx.accounts.buyer.key(), is_signer: false, is_writable: true },
        SerializableAccountMeta { pubkey: System::id(), is_signer: false, is_writable: false }
    ];
    
    let ix = create_request_randomness_ix(
        RequestRandomnessParams{
            payer: ctx.accounts.buyer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: ResolveTicket::DISCRIMINATOR.to_vec(),
            accounts_metas: Some(callback_accounts),
            caller_seed: 
            {
                let mut seed = [0u8; 32];
                seed[..8].copy_from_slice(&ctx.accounts.pool.pool_id.to_le_bytes());
                seed[8] = ctx.accounts.pool.ticket_left;
                seed
            },
            ..Default::default()
        });
    ctx.accounts.invoke_signed_vrf(&ctx.accounts.buyer.to_account_info(), &ix)?;

    Ok(())
}

#[vrf]
#[derive(Accounts)]
pub struct BuyTicket<'info>
{
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [POOL_SEED, pool.pool_id.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    /// CHECK: The oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}