use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct FeeConfig {
    pub liquidity_pool: Pubkey,
    pub marketing_vault: Pubkey,
    pub fee_percent_holders: u16, // 500 means 5%
    pub fee_percent_marketing: u16, // 400 means 4%
    pub fee_percent_liqudity: u16, // 100 means 1%
}
