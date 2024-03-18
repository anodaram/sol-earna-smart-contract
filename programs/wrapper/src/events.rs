//! Crate events

use anchor_lang::prelude::*;

#[event]
pub struct TreasuryCreated {
    pub authority: Pubkey,
    pub treasury_mint: Pubkey,
    pub wrapper_mint: Pubkey,
    pub treasury_token_account: Pubkey,
}

#[event]
pub struct Deposited {
    pub treasury: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Claimed {
    pub treasury: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}