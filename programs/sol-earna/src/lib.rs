use anchor_lang::prelude::*;

declare_id!("2me2g1K7KVA7RBhg1rcbpxRvCknd4v1UCA8RMEjm3hmg");

#[program]
pub mod sol_earna {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
