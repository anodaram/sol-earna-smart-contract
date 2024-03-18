
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Treasury {
    pub authority: Pubkey,
    pub treasury_mint: Pubkey,
    pub wrapper_mint: Pubkey,
    pub treasury_token_account: Pubkey,
}
