use anchor_lang::prelude::*;

declare_id!("3ZgdeiLicn4YBxDokpmYuitsAonCtnLPnXtbwLPn8WCa");

#[program]
pub mod wrapper {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
