import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolEarna } from "../target/types/sol_earna";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createInitializeTransferFeeConfigInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  createTransferCheckedWithTransferHookInstruction,
  createWithdrawWithheldTokensFromAccountsInstruction,
  getTransferFeeAmount,
  unpackAccount,
} from "@solana/spl-token";
import assert from "assert";

import {
  EXTRA_ACCOUNT_METAS_TAG,
  FEE_CONFIG_TAG,
  FEE_RECIPIENT_HOLDERS_TAG
} from "./constants";

const PUT_LOG = false;

describe("sol-earna", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolEarna as Program<SolEarna>;
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  // Generate keypair to use as address for the transfer-hook enabled mint
  const mint = new Keypair();
  const decimals = 9;

  const feeRecipientLiquidity = Keypair.generate();
  const feeRecipientMarketing = Keypair.generate();

  // PUT_LOG && console.log(feeRecipientLiquidity.secretKey);
  // PUT_LOG && console.log(feeRecipientMarketing.secretKey);

  const FEE_PERCENT_HOLDERS = 500; // 5%
  const FEE_PERCENT_MARKETING = 400; // 4%
  const FEE_PERCENT_LIQUIDITY = 100; // 1%
  const TOTAL_FEE_PERCENT = FEE_PERCENT_HOLDERS + FEE_PERCENT_MARKETING + FEE_PERCENT_LIQUIDITY;

  // ExtraAccountMetaList address
  // Store extra accounts required by the custom transfer hook instruction
  const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_METAS_TAG, mint.publicKey.toBuffer()],
    program.programId
  );

  const [feeConfigPDA] = PublicKey.findProgramAddressSync(
    [FEE_CONFIG_TAG, mint.publicKey.toBuffer()],
    program.programId
  );

  const [feeRecipientHoldersPDA] = PublicKey.findProgramAddressSync(
    [FEE_RECIPIENT_HOLDERS_TAG],
    program.programId
  );

  const liquidityTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    feeRecipientLiquidity.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const marketingTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    feeRecipientMarketing.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const holdersTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    feeRecipientHoldersPDA,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const feeStorageTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );


  console.log(wallet.publicKey, wallet.payer.secretKey);
  const tmp = Keypair.fromSecretKey(wallet.payer.secretKey);
  console.log({ tmp: JSON.stringify(tmp) });

  return;

  it("Create Mint Account with Transfer Hook Extension", async () => {
    const extensions = [ExtensionType.TransferFeeConfig, ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(mintLen);

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mint.publicKey,
        wallet.publicKey,
        program.programId, // Transfer Hook Program ID
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeTransferFeeConfigInstruction(
        mint.publicKey,
        wallet.publicKey,
        wallet.publicKey,
        TOTAL_FEE_PERCENT,
        BigInt(1_000_000_000),
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        wallet.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );

    const txSig = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [wallet.payer, mint],
      undefined
    );
    PUT_LOG && console.log(`Transaction Signature: ${txSig}`);
  });

  it("Prepare Fee Recipient Accounts", async () => {
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        liquidityTokenAccount,
        feeRecipientLiquidity.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        marketingTokenAccount,
        feeRecipientMarketing.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        holdersTokenAccount,
        feeRecipientHoldersPDA,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        feeStorageTokenAccount,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
    );

    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true }
    );

    PUT_LOG && console.log(`Transaction Signature: ${txSig}`);
  });

  // Account to store extra accounts required by the transfer hook instruction
  it("Create ExtraAccountMetaList Account", async () => {
    const extraAccountMetasInfo = await connection.getAccountInfo(extraAccountMetaListPDA);

    PUT_LOG && console.log("Extra accounts meta: " + extraAccountMetasInfo);

    const initializeExtraAccountMetaListInstruction = await program.methods
      .initializeExtraAccountMetaList(
        FEE_PERCENT_HOLDERS,
        FEE_PERCENT_MARKETING,
        FEE_PERCENT_LIQUIDITY
      )
      .accounts(
        {
          extraAccountMetaList: extraAccountMetaListPDA,
          mint: mint.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          feeConfig: feeConfigPDA,
          liquidityTokenAccount,
          marketingTokenAccount,
          holdersTokenAccount,
        }
      )
      .instruction();

    const transaction = new Transaction().add(
      initializeExtraAccountMetaListInstruction
    );

    const txSig = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true, commitment: "confirmed" }
    );
    PUT_LOG && console.log("Transaction Signature:", txSig);
  });

  // Sender token account address
  const sender = Keypair.generate();
  const sourceTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    sender.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Recipient token account address
  const recipient = Keypair.generate();
  const destinationTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Create the two token accounts for the transfer-hook enabled mint
  // Fund the sender token account with 100 tokens
  it("Create Token Accounts and Mint Tokens", async () => {
    // airdrop SOL to accounts
    const signature = await connection.requestAirdrop(
      new PublicKey(sender.publicKey),
      100 * 10 ** 9
    );
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature
    }, 'finalized');

    // 100 tokens
    const amount = 100 * 10 ** decimals;

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        sourceTokenAccount,
        sender.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destinationTokenAccount,
        recipient.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mint.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        amount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true }
    );

    PUT_LOG && console.log(`Transaction Signature: ${txSig}`);
  });

  it("Transfer Hook with Extra Account Meta", async () => {
    // 1 tokens
    const amount = 1 * 10 ** decimals;
    const bigIntAmount = BigInt(amount);
    const balanceSourceBefore = (await getAccount(connection, sourceTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    const balanceDestinationBefore = (await getAccount(connection, destinationTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    PUT_LOG && console.log({ balanceSourceBefore, balanceDestinationBefore });

    // Standard token transfer instruction
    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection, // connection: Connection,
      sourceTokenAccount, // source: PublicKey,
      mint.publicKey, // mint: PublicKey,
      destinationTokenAccount, // destination: PublicKey,
      sender.publicKey, // owner: PublicKey,
      bigIntAmount, // amount: bigint,
      decimals, // decimals: number,
      [sender.publicKey], // multiSigners: (Signer | PublicKey)[] = [],
      "confirmed", // commitment?: Commitment,
      TOKEN_2022_PROGRAM_ID, // programId = TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(
      transferInstruction
    );

    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [sender],
      { skipPreflight: true }
    );
    PUT_LOG && console.log("Transfer Signature:", txSig);

    const balanceSourceAfter = (await getAccount(connection, sourceTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    const balanceDestinationAfter = (await getAccount(connection, destinationTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    PUT_LOG && console.log({ balanceSourceAfter, balanceDestinationAfter });
  });

  it("Transfer Hook with Extra Account Meta2", async () => {
    // 1 tokens
    const amount = 1 * 10 ** decimals - 1;
    const bigIntAmount = BigInt(amount);
    const balanceSourceBefore = (await getAccount(connection, sourceTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    const balanceDestinationBefore = (await getAccount(connection, destinationTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    PUT_LOG && console.log({ balanceSourceBefore, balanceDestinationBefore });

    // Standard token transfer instruction
    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      sourceTokenAccount,
      mint.publicKey,
      destinationTokenAccount,
      sender.publicKey,
      bigIntAmount,
      decimals,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );

    const transaction = new Transaction().add(
      transferInstruction
    );

    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [sender],
      { skipPreflight: true }
    );
    PUT_LOG && console.log("Transfer Signature:", txSig);

    const balanceSourceAfter = (await getAccount(connection, sourceTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    const balanceDestinationAfter = (await getAccount(connection, destinationTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    PUT_LOG && console.log({ balanceSourceAfter, balanceDestinationAfter });
  });

  it("Collect Fee", async () => {
    const allAccounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
      commitment: "confirmed",
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: mint.publicKey.toString(), // Mint Account address
          },
        },
      ],
    });
    // List of Token Accounts to withdraw fees from
    const accountsToWithdrawFrom = [];

    for (const accountInfo of allAccounts) {
      const account = unpackAccount(
        accountInfo.pubkey, // Token Account address
        accountInfo.account, // Token Account data
        TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
      );

      // Extract transfer fee data from each account
      const transferFeeAmount = getTransferFeeAmount(account);
      PUT_LOG && console.log(accountInfo, transferFeeAmount);

      // Check if fees are available to be withdrawn
      if (transferFeeAmount !== null && transferFeeAmount.withheldAmount > 0) {
        accountsToWithdrawFrom.push(accountInfo.pubkey); // Add account to withdrawal list
      }
    }
    PUT_LOG && console.log({ accountsToWithdrawFrom });

    const transferInstruction = createWithdrawWithheldTokensFromAccountsInstruction(
      mint.publicKey,
      feeStorageTokenAccount,
      wallet.publicKey,
      [],
      accountsToWithdrawFrom,
      TOKEN_2022_PROGRAM_ID
    );

    const transaction = new Transaction().add(
      transferInstruction
    );
    const balanceFeeStorageBefore = (await getAccount(connection, feeStorageTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;

    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true }
    );
    PUT_LOG && console.log("Transfer Signature:", txSig);

    const balanceFeeStorageAfter = (await getAccount(connection, feeStorageTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    PUT_LOG && console.log({ balanceFeeStorageAfter });

    const collectedFee = (balanceFeeStorageAfter - balanceFeeStorageBefore).toString();
    PUT_LOG && console.log({ collectedFee });

    const txSig2 = await program.methods.feeCollected(new anchor.BN(collectedFee)).accounts({
      owner: wallet.publicKey,
      mint: mint.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      feeConfig: feeConfigPDA,
      feeStorageTokenAccount: feeStorageTokenAccount
    })
      .signers([wallet.payer])
      .rpc();
    PUT_LOG && console.log("Transfer Signature2:", txSig2);

  });

  it("Claim Fee for Marketing", async () => {
    const feeConfig = await program.account.feeConfig.fetch(feeConfigPDA);
    const unclaimedFeeMarketing = feeConfig.unclaimedFeeMarketing;

    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      feeStorageTokenAccount,
      mint.publicKey,
      marketingTokenAccount,
      wallet.publicKey,
      BigInt(unclaimedFeeMarketing.toString()),
      decimals,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const txSig1 = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(transferInstruction),
      [wallet.payer],
      { skipPreflight: true }
    );
    PUT_LOG && console.log("Transfer Signature:", txSig1);

    PUT_LOG && console.log({ feeRecipientMarketing: feeRecipientMarketing.publicKey });

    const txSig2 = await program.methods.feeClaimed(unclaimedFeeMarketing).accounts({
      owner: wallet.publicKey, // owner
      user: feeRecipientMarketing.publicKey, // user
      destinationToken: marketingTokenAccount, // destination_token
      mint: mint.publicKey, // mint
      tokenProgram: TOKEN_2022_PROGRAM_ID, // token_program
      feeConfig: feeConfigPDA, // fee_config
      feeStorageTokenAccount: feeStorageTokenAccount // fee_storage_token_account
    })
      .signers([wallet.payer])
      .rpc();

    PUT_LOG && console.log("Transfer Signature:", txSig2);
    const marketingRewardAfter = (await getAccount(connection, marketingTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    PUT_LOG && console.log({ marketingRewardAfter });
  });

  it("Claim Fee for Liquidity", async () => {
    const feeConfig = await program.account.feeConfig.fetch(feeConfigPDA);
    const unclaimedFeeLiquidity = feeConfig.unclaimedFeeLiquidity;

    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      feeStorageTokenAccount,
      mint.publicKey,
      liquidityTokenAccount,
      wallet.publicKey,
      BigInt(unclaimedFeeLiquidity.toString()),
      decimals,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const txSig1 = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(transferInstruction),
      [wallet.payer],
      { skipPreflight: true }
    );
    PUT_LOG && console.log("Transfer Signature:", txSig1);

    PUT_LOG && console.log({ feeRecipientliquidity: feeRecipientLiquidity.publicKey });

    const txSig2 = await program.methods.feeClaimed(unclaimedFeeLiquidity).accounts({
      owner: wallet.publicKey, // owner
      user: feeRecipientLiquidity.publicKey, // user
      destinationToken: liquidityTokenAccount, // destination_token
      mint: mint.publicKey, // mint
      tokenProgram: TOKEN_2022_PROGRAM_ID, // token_program
      feeConfig: feeConfigPDA, // fee_config
      feeStorageTokenAccount: feeStorageTokenAccount // fee_storage_token_account
    })
      .signers([wallet.payer])
      .rpc();

    PUT_LOG && console.log("Transfer Signature:", txSig2);
    const liquidityRewardAfter = (await getAccount(connection, liquidityTokenAccount, 'processed', TOKEN_2022_PROGRAM_ID)).amount;
    PUT_LOG && console.log({ liquidityRewardAfter });
  });

  it("Claim Fee for Holders", async () => {
    // No need to test here, will be in DApp
  });
});
