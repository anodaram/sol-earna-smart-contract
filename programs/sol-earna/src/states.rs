use anchor_lang::prelude::*;

#[account]
pub struct FeeConfig {
    pub marketing_token_account: Pubkey,
    pub liquidity_token_account: Pubkey,
    pub holders_token_account: Pubkey,
    pub fee_percent_holders: u16, // 500 means 5%
    pub fee_percent_marketing: u16, // 400 means 4%
    pub fee_percent_liqudity: u16, // 100 means 1%
}

#[account]
pub struct CounterAccount {
    counter: u8,
}
