use anchor_lang::prelude::*;

#[account]
pub struct FeeConfig {
    pub wrapper_token_address: Pubkey,
    pub fee_recipient_liquidity: Pubkey,
    pub fee_recipient_marketing: Pubkey,
    pub fee_recipient_holders: Pubkey,
    pub fee_percent_liquidity: u16, // 100 means 1%
    pub fee_percent_marketing: u16, // 400 means 4%
    pub fee_percent_holders: u16,   // 500 means 5%
}
