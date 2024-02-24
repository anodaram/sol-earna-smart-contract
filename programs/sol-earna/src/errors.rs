use anchor_lang::prelude::*;

#[error_code]
pub enum SolEarnaError {
    #[msg("Collect fee amount mismatch with balance")]
    CollectFeeAmountMismatch,
}
