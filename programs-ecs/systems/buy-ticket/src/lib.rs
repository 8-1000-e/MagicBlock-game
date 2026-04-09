use bolt_lang::*;
use bolt_lang::solana_program::{program::invoke, system_instruction};
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use pool::Pool;
use shared::*;

declare_id!("9As38cKdZYeMStQjfDdWgTUKTBLpxb4XUhPd6FtJhtbW");

// Discriminator of the `vrf_callback_resolve_ticket` instruction in the
// `pool` component program. Anchor derives discriminators as
// sha256("global:<snake_name>")[..8]. We import it via the cpi crate.
//
// Required remaining_accounts (in this order):
//   [0] buyer (signer, writable)
//   [1] pool PDA AccountInfo (writable, same key as ctx.accounts.pool)
//   [2] system_program
//   [3] oracle_queue (DEFAULT_QUEUE)
//   [4] vrf_program (ephemeral_vrf_sdk::ID)
//   [5] slot_hashes
//   …plus any extra accounts the VRF program needs (passed through).

#[system]
pub mod buy_ticket {
    pub fn execute(ctx: Context<Components>, _args: Vec<u8>) -> Result<Components> {
        let pool_acc = &mut ctx.accounts.pool;
        require!(pool_acc.status == STATUS_OPEN, CardeError::PoolNotOpen);
        require!(pool_acc.ticket_left > 0, CardeError::NoTicketsLeft);

        let rem = ctx.remaining_accounts;
        require!(rem.len() >= 6, CardeError::PoolNotOpen);
        let buyer_ai = &rem[0];
        let pool_ai = &rem[1];
        let system_program_ai = &rem[2];
        let oracle_queue_ai = &rem[3];
        require!(buyer_ai.is_signer, CardeError::PoolNotOpen);
        require_keys_eq!(*pool_ai.key, pool_acc.key(), CardeError::PoolNotOpen);

        // Transfer SOL: buyer → pool PDA
        invoke(
            &system_instruction::transfer(buyer_ai.key, pool_ai.key, pool_acc.ticket_price),
            &[buyer_ai.clone(), pool_ai.clone(), system_program_ai.clone()],
        )?;

        // Mutate pool BEFORE issuing the VRF request — the World will write
        // these changes back to the PDA when the system returns.
        pool_acc.ticket_left = pool_acc.ticket_left.checked_sub(1).ok_or(CardeError::NoTicketsLeft)?;
        pool_acc.last_buyer = buyer_ai.key();
        pool_acc.status = STATUS_PENDING_VRF;

        // Build the VRF randomness request. Callback target = pool component
        // program; callback discriminator = `vrf_callback_resolve_ticket`.
        let pool_program_id = pool::id();
        let callback_accounts = vec![
            SerializableAccountMeta {
                pubkey: pool_acc.key(),
                is_signer: false,
                is_writable: true,
            },
            SerializableAccountMeta {
                pubkey: buyer_ai.key(),
                is_signer: false,
                is_writable: true,
            },
        ];

        // Anchor instruction discriminator for `vrf_callback_resolve_ticket`,
        // re-exported by the pool component's cpi crate.
        let disc = pool::instruction::VrfCallbackResolveTicket::DISCRIMINATOR.to_vec();

        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: buyer_ai.key(),
            oracle_queue: oracle_queue_ai.key(),
            callback_program_id: pool_program_id,
            callback_discriminator: disc,
            accounts_metas: Some(callback_accounts),
            caller_seed: {
                // Unique seed per request: pool PDA pubkey (first 31 bytes)
                // + ticket_left (1 byte). Guarantees a fresh seed for every
                // ticket of every pool.
                let mut seed = [0u8; 32];
                seed[..31].copy_from_slice(&pool_acc.key().to_bytes()[..31]);
                seed[31] = pool_acc.ticket_left;
                seed
            },
            ..Default::default()
        });

        // Invoke the VRF request. All accounts referenced by `ix.accounts`
        // must be present in `rem` — the runtime will resolve them by pubkey.
        invoke(&ix, rem)?;

        Ok(ctx.accounts)
    }

    #[system_input]
    pub struct Components {
        pub pool: Pool,
    }
}
