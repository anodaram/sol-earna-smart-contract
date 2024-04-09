use anchor_lang::{
    prelude::*,
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::*;
use states::*;
use errors::*;
use constants::*;


#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList Account, must use these seeds
    #[account(
        mut,
        seeds = [EXTRA_ACCOUNT_METAS_TAG, mint.key().as_ref()], 
        bump
    )]
    pub extra_account_meta_list: AccountInfo<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub token_program_org: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    #[account(
        init_if_needed,
        seeds = [FEE_CONFIG_TAG, mint.key().as_ref()],
        bump,
        payer = payer,
        space = std::mem::size_of::<FeeConfig>() + 8,
    )]
    pub fee_config: Account<'info, FeeConfig>,

    #[account(
        mut,
        seeds = [TREASURY_TAG, treasury.treasury_mint.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    pub wsol_mint: InterfaceAccount<'info, Mint>,

    pub wrapper_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub fee_recipient_liquidity: SystemAccount<'info>,
    #[account(mut)]
    pub fee_recipient_marketing: SystemAccount<'info>,
    #[account(mut)]
    pub fee_recipient_holders: SystemAccount<'info>,
}

// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the token2022 program
#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(
        token::mint = mint, 
        token::authority = owner,
    )]
    pub source_token: InterfaceAccount<'info, TokenAccount>, // 0
    pub mint: InterfaceAccount<'info, Mint>, // 1
    #[account(
        token::mint = mint,
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount>, // 2
    /// CHECK: source token account owner, can be SystemAccount or PDA owned by another program
    pub owner: UncheckedAccount<'info>, // 3
    /// CHECK: ExtraAccountMetaList Account,
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()], 
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>, // 4

    pub token_program: Interface<'info, TokenInterface>, // 5
    pub token_program_org: Interface<'info, TokenInterface>, // 6
    pub associated_token_program: Program<'info, AssociatedToken>, // 7

    #[account(
        mut,
        seeds = [DELEGATE_TAG, mint.key().as_ref()],
        bump
    )]
    pub delegate: SystemAccount<'info>, // 8

    #[account(mut)]
    pub fee_config: Box<Account<'info, FeeConfig>>, // 9

    #[account(
        mut,
        seeds = [TREASURY_TAG, treasury.treasury_mint.as_ref()],
        bump,
    )]
    pub treasury: Box<Account<'info, Treasury>>, // 10

    pub wsol_mint: InterfaceAccount<'info, Mint>, // 11

    pub wrapper_mint: Box<InterfaceAccount<'info, Mint>>, // 12
    #[account(
        mut,
        token::mint = wrapper_mint,
        token::authority = delegate,
    )]
    pub fee_wrapper_token_account: InterfaceAccount<'info, TokenAccount>, // 13
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct SwapFeeOnExchange<'info> {
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [FEE_CONFIG_TAG, mint.key().as_ref()],
        bump,
    )]
    pub fee_config: Account<'info, FeeConfig>,

    #[account(
        mut,
        seeds = [TREASURY_TAG, treasury.treasury_mint.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    pub wsol_mint: InterfaceAccount<'info, Mint>,

    pub wrapper_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub fee_recipient_liquidity: SystemAccount<'info>,
    #[account(
        mut,
        token::mint = wsol_mint,
        token::authority = fee_recipient_liquidity,
    )]
    pub fee_liquidity_wsol_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub fee_recipient_marketing: SystemAccount<'info>,
    #[account(
        mut,
        token::mint = wsol_mint,
        token::authority = fee_recipient_marketing,
    )]
    pub fee_marketing_wsol_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub fee_recipient_holders: SystemAccount<'info>,
    #[account(
        mut,
        token::mint = wsol_mint,
        token::authority = fee_recipient_holders,
    )]
    pub fee_holders_wsol_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
}


#[derive(Accounts)]
#[instruction()]
pub struct CreateTreasury<'info> {
    #[account(
        init,
        seeds = [TREASURY_TAG, treasury_mint.key().as_ref()],
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
        payer = authority,
    )]
    pub wrapper_mint: Box<InterfaceAccount<'info, Mint>>,

    // #[account(mut)]
    // pub wrapper_mint_auth: Signer<'info>,
    #[account(
        mut,
        token::mint = treasury_mint,
        token::authority = treasury,
    )]
    pub treasury_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Stake<'info> {
    #[account(
        seeds = [TREASURY_TAG, treasury.treasury_mint.as_ref()],
        bump,
    )]
    pub treasury: Box<Account<'info, Treasury>>,
    #[account(
        mut,
        constraint = treasury.wrapper_mint == wrapper_mint.key() @ XError::InvalidWrapperMint,
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
        payer = user,
    )]
    pub user_wrapper_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>, // should be TOKEN_PROGRAM_ID (not TOKEN_2022_PROGRAM_ID)
    pub token_program_treasury: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Redeem<'info> {
    #[account(
        seeds = [TREASURY_TAG, treasury.treasury_mint.as_ref()],
        bump,
    )]
    pub treasury: Box<Account<'info, Treasury>>,
    #[account(
        mut,
        constraint = treasury.wrapper_mint == wrapper_mint.key() @ XError::InvalidWrapperMint,
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
