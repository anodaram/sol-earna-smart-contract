use anchor_lang::prelude::*;

declare_id!("xnwVapsgETFh2cz8LFPfTyneACVaMtxbR7D7KeFH3K8");

#[program]
pub mod sol_earna {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
