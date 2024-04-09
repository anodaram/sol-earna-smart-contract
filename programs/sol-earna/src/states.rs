use anchor_lang::prelude::*;

#[account]
pub struct FeeConfig {
    pub wsol_mint_address: Pubkey,
    pub wrapper_mint_address: Pubkey,
    pub fee_recipient_liquidity: Pubkey,
    pub fee_recipient_marketing: Pubkey,
    pub fee_recipient_holders: Pubkey,
    pub fee_percent_liquidity: u16, // 100 means 1%
    pub fee_percent_marketing: u16, // 400 means 4%
    pub fee_percent_holders: u16,   // 500 means 5%
}

#[account]
#[derive(Default)]
pub struct Treasury {
    pub authority: Pubkey,
    pub treasury_mint: Pubkey,
    pub wrapper_mint: Pubkey,
    pub treasury_token_account: Pubkey,
}
