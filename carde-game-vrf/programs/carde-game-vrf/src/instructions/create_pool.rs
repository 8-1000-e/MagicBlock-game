use anchor_lang::prelude::*;

pub fn _create_pool(ctx: Context<CreatePool>, pool_id: u64, prize_pool: u64, ticket_price: u64) -> Result<()> 
{
    
    Ok(())
}


#[derive(Accounts)]
pub struct CreatePool<'info>
{
    #[account(mut)]
    creator: Signer<'info>,

}