use anchor_lang::prelude::*;

use anchor_spl::{
    self, associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface}
};

use crate::*;
use constants::*;
use errors::*;
use states::*;

#[derive(Accounts)]
#[instruction()]
pub struct CreateTreasury<'info> {
    #[account(
        init,
        seeds = [TREASURY_TAG, treasury_mint.key().as_ref(), authority.key().as_ref()],
        bump,
        payer = authority,
        space = std::mem::size_of::<Treasury>() + 8
    )]
    pub treasury: Box<Account<'info, Treasury>>,

    #[account(mut)]
    pub treasury_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        mint::decimals = treasury_mint.decimals,
        mint::authority = treasury,
        seeds = [WRAPPER_MINT_TAG, treasury.key().as_ref()],
        bump,
        payer = authority,
    )]
    pub wrapper_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        token::mint = treasury_mint,
        token::authority = treasury,
    )]
    pub treasury_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>, // should be TOKEN_PROGRAM_ID (not TOKEN_2022_PROGRAM_ID)
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Stake<'info> {
    #[account(
        seeds = [TREASURY_TAG, treasury.treasury_mint.as_ref(), treasury.authority.as_ref()],
        bump,
    )]
    pub treasury: Box<Account<'info, Treasury>>,
    #[account(
        mut,
        seeds = [WRAPPER_MINT_TAG, treasury.key().as_ref()],
        bump,
    )]
    pub wrapper_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = treasury.treasury_mint == treasury_mint.key() @ XError::InvalidTreasuryMint,
    )]
    pub treasury_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = treasury_mint,
        token::authority = treasury,
    )]
    pub treasury_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = treasury_mint,
        token::authority = user
    )]
    pub user_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        token::mint = wrapper_mint,
        token::authority = user,
        seeds = [USER_WRAPPER_TOKEN_ACCOUNT_TAG, wrapper_mint.key().as_ref(), user.key().as_ref()],
        bump,
        payer = user
    )]
    pub user_wrapper_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>, // should be TOKEN_PROGRAM_ID (not TOKEN_2022_PROGRAM_ID)
    pub token_program_treasury: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Redeem<'info> {
    #[account(
        seeds = [TREASURY_TAG, treasury.treasury_mint.as_ref(), treasury.authority.as_ref()],
        bump,
    )]
    pub treasury: Box<Account<'info, Treasury>>,
    #[account(
        mut,
        seeds = [WRAPPER_MINT_TAG, treasury.key().as_ref()],
        bump,
    )]
    pub wrapper_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = treasury.treasury_mint == treasury_mint.key() @ XError::InvalidTreasuryMint,
    )]
    pub treasury_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = treasury_mint,
        token::authority = treasury,
    )]
    pub treasury_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = treasury_mint,
        token::authority = user
    )]
    pub user_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub user_wrapper_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub user: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>, // should be TOKEN_PROGRAM_ID (not TOKEN_2022_PROGRAM_ID)
    pub token_program_treasury: Interface<'info, TokenInterface>,
}
