use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

use crate::*;
use states::*;
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
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    #[account(
        init_if_needed,
        seeds = [FEE_CONFIG_TAG, mint.key().as_ref(), payer.key().as_ref()],
        bump,
        payer = payer,
        space = std::mem::size_of::<FeeConfig>() + 8
    )]
    pub fee_config: Account<'info, FeeConfig>,

    #[account(
        mut,
        token::mint = mint,
        // token::authority = payer, // no need to check authority
    )]
    pub marketing_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        // token::authority = payer, // no need to check authority
    )]
    pub liquidity_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        // token::authority = payer, // no need to check authority
    )]
    pub holders_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
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
    pub source_token: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = mint,
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: source token account owner, can be SystemAccount or PDA owned by another program
    pub owner: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList Account,
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()], 
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    #[account(
        mut,
        seeds = [FEE_CONFIG_TAG, mint.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub fee_config: Account<'info, FeeConfig>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    /// CHECK: source token account owner, can be SystemAccount or PDA owned by another program
    pub owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        token::mint = mint,
        token::authority = user,
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,
    
    pub token_program: Interface<'info, TokenInterface>,

    #[account(
        mut,
        seeds = [FEE_CONFIG_TAG, mint.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub fee_config: Account<'info, FeeConfig>,

    #[account(
        mut,
        seeds = [FEE_STORAGE_TAG], // TODO: need to put owner in the seeds list, for the purpose of security
        bump,
    )]
    pub fee_storage: SystemAccount<'info>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = fee_storage,
    )]
    pub fee_storage_token_account: InterfaceAccount<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct FeeCollected<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    
    pub token_program: Interface<'info, TokenInterface>,

    #[account(
        mut,
        seeds = [FEE_CONFIG_TAG, mint.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub fee_config: Account<'info, FeeConfig>,

    #[account(
        mut,
        seeds = [FEE_STORAGE_TAG], // TODO: need to put owner in the seeds list, for the purpose of security
        bump,
    )]
    pub fee_storage: SystemAccount<'info>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = fee_storage,
    )]
    pub fee_storage_token_account: InterfaceAccount<'info, TokenAccount>,
}
