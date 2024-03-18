use anchor_lang::prelude::*;

declare_id!("3ZgdeiLicn4YBxDokpmYuitsAonCtnLPnXtbwLPn8WCa");

mod processors;
pub mod errors;
pub mod events;
pub mod states;
pub mod utils;
pub mod contexts;
pub mod constants ;

pub use contexts::*;
pub use utils::*;

#[program] 
pub mod wrapper {
    use super::*;

    pub fn create_treasury(
        ctx: Context<CreateTreasury>,
    ) -> Result<()> {
        ctx.accounts.create_treasury()
    }
    
    pub fn stake(
        ctx: Context<Stake>,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.stake(
            ctx.bumps.treasury,
            amount,
        )
    }
    pub fn redeem(
        ctx: Context<Redeem>,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.redeem(
            ctx.bumps.treasury,
            amount,
        )
    }
}
