import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { pack, TokenMetadata } from "@solana/spl-token-metadata";

import { SolEarna } from "../target/types/sol_earna";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeTransferHookInstruction,
  createMintToInstruction,
  createTransferCheckedWithTransferHookInstruction,
  createUpdateFieldInstruction,
  ExtensionType,
  getAccount,
  getAssociatedTokenAddressSync,
  getMintLen,
  LENGTH_SIZE,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TYPE_SIZE,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  EXTRA_ACCOUNT_METAS_TAG,
  FEE_CONFIG_TAG,
  TREASURY_TAG,
} from "./constants";
import { pda } from "./utils";

const PUT_LOG = false;

describe("sol-earna", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolEarna as Program<SolEarna>;

  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  const mintAuth = new Keypair();
  const mint = mintAuth.publicKey;
  const decimals = 9;

  console.log({ mint: mint.toBase58() });

  const feeRecipientLiquidity = Keypair.generate();
  const feeRecipientMarketing = Keypair.generate();
  const feeRecipientHolders = Keypair.generate();

  const FEE_PERCENT_HOLDERS = 500; // 5%
  const FEE_PERCENT_MARKETING = 400; // 4%
  const FEE_PERCENT_LIQUIDITY = 100; // 1%
  const TOTAL_FEE_PERCENT =
    FEE_PERCENT_HOLDERS + FEE_PERCENT_MARKETING + FEE_PERCENT_LIQUIDITY;

  const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_METAS_TAG, mint.toBuffer()],
    program.programId
  );

  const [feeConfigPDA] = PublicKey.findProgramAddressSync(
    [FEE_CONFIG_TAG, mint.toBuffer()],
    program.programId
  );

  it("Initialize!", async () => {});
  it("Create Mint Account with Transfer Hook Extension", async () => {
    const metaData: TokenMetadata = {
      updateAuthority: wallet.publicKey,
      mint: mint,
      name: "Sol Earna",
      symbol: "SolE",
      uri: "",
      additionalMetadata: [["description", "This is Sol Earna Token"]],
    };

    // Size of MetadataExtension 2 bytes for type, 2 bytes for length
    const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
    // Size of metadata
    const metadataLen = pack(metaData).length;

    const extensions = [
      ExtensionType.TransferFeeConfig,
      ExtensionType.TransferHook,
      ExtensionType.MetadataPointer,
    ];
    const mintLen = getMintLen(extensions);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(
        mintLen + metadataExtension + metadataLen
      );

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mint,
        wallet.publicKey,
        program.programId, // Transfer Hook Program ID
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeTransferFeeConfigInstruction(
        mint,
        wallet.publicKey,
        wallet.publicKey,
        TOTAL_FEE_PERCENT,
        BigInt(1_000_000_000),
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMetadataPointerInstruction(
        mint, // Mint Account address
        wallet.publicKey, // Authority that can set the metadata address
        mint, // Account address that holds the metadata
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint,
        decimals,
        wallet.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
        metadata: mint, // Account address that holds the metadata
        updateAuthority: wallet.publicKey, // Authority that can update the metadata
        mint: mint, // Mint Account address
        mintAuthority: wallet.publicKey, // Designated Mint Authority
        name: metaData.name,
        symbol: metaData.symbol,
        uri: metaData.uri,
      }),
      createUpdateFieldInstruction({
        programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
        metadata: mint, // Account address that holds the metadata
        updateAuthority: wallet.publicKey, // Authority that can update the metadata
        field: metaData.additionalMetadata[0][0], // key
        value: metaData.additionalMetadata[0][1], // value
      })
    );

    const txSig = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [wallet.payer, mintAuth],
      undefined
    );
    PUT_LOG && console.log(`Transaction Signature: ${txSig}`);
  });

  let feeWsolTokenAccount: PublicKey;
  let wrapperMint: PublicKey;
  let feeWrapperTokenAccount: PublicKey;
  let feeLiquidityWsolTokenAccount: PublicKey;
  let feeMarketingWsolTokenAccount: PublicKey;
  let feeHoldersWsolTokenAccount: PublicKey;
  let treasury: PublicKey;
  let treasuryTokenAccount: PublicKey;

  it("Create Treasury for Wrapper Mint", async () => {
    treasury = await pda(
      [TREASURY_TAG, mint.toBuffer()],
      program.programId
    );
    const wrapperMintAuth = new Keypair();
    wrapperMint = wrapperMintAuth.publicKey;

    treasuryTokenAccount = getAssociatedTokenAddressSync(
      mint,
      treasury,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        treasuryTokenAccount,
        treasury,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true }
    );
    console.log(`Transaction Signature: ${txSig}`);

    const txSig2 = await program.methods
      .createTreasury()
      .accounts({
        treasury,
        treasuryMint: mint,
        wrapperMint,
        treasuryTokenAccount,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([wallet.payer, wrapperMintAuth])
      .rpc();

    console.log(`Transaction Signature: ${txSig2}`);

    const treasuryData = await program.account.treasury.fetch(treasury);
    console.log({ treasuryData });
  });

  it("Prepare accounts", async () => {
    feeWrapperTokenAccount = getAssociatedTokenAddressSync(
      wrapperMint,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    feeWsolTokenAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      wallet.publicKey
    );
    feeLiquidityWsolTokenAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      feeRecipientLiquidity.publicKey
    );
    feeMarketingWsolTokenAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      feeRecipientMarketing.publicKey
    );
    feeHoldersWsolTokenAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      feeRecipientHolders.publicKey
    );

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        feeWrapperTokenAccount,
        wallet.publicKey,
        wrapperMint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        feeWsolTokenAccount,
        wallet.publicKey,
        NATIVE_MINT
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        feeLiquidityWsolTokenAccount,
        feeRecipientLiquidity.publicKey,
        NATIVE_MINT
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        feeMarketingWsolTokenAccount,
        feeRecipientMarketing.publicKey,
        NATIVE_MINT
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        feeHoldersWsolTokenAccount,
        feeRecipientHolders.publicKey,
        NATIVE_MINT
      )
    );
    const txSig = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true, commitment: "confirmed" }
    );
    PUT_LOG && console.log("Transaction Signature:", txSig);
  });

  // Account to store extra accounts required by the transfer hook instruction
  it("Create ExtraAccountMetaList Account", async () => {
    const extraAccountMetasInfo = await connection.getAccountInfo(
      extraAccountMetaListPDA
    );

    PUT_LOG && console.log("Extra accounts meta: " + extraAccountMetasInfo);
    console.log({
      payer: wallet.publicKey.toBase58(), // payer
      extraAccountMetaList: extraAccountMetaListPDA.toBase58(), // extra_account_meta_list
      mint: mint.toBase58(), // mint
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(), // token_program
      tokenProgramOrg: TOKEN_PROGRAM_ID.toBase58(), // token_program
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(), // associated_token_program
      systemProgram: SystemProgram.programId.toBase58(), // system_program
      feeConfig: feeConfigPDA.toBase58(), // fee_config
      wsolMint: NATIVE_MINT.toBase58(), // wsol_mint
      feeWsolTokenAccount: feeWsolTokenAccount.toBase58(), // fee_wsol_token_account
      wrapperMint: wrapperMint.toBase58(), // wrapper_mint
      feeWrapperTokenAccount: feeWrapperTokenAccount.toBase58(), // fee_wrapper_token_account
      feeRecipientLiquidity: feeRecipientLiquidity.publicKey.toBase58(), // fee_recipient_liquidity
      feeLiquidityWsolTokenAccount: feeLiquidityWsolTokenAccount.toBase58(), // fee_liquidity_wsol_token_account
      feeRecipientMarketing: feeRecipientMarketing.publicKey.toBase58(), // fee_recipient_marketing
      feeMarketingWsolTokenAccount: feeMarketingWsolTokenAccount.toBase58(), // fee_marketing_wsol_token_account
      feeRecipientHolders: feeRecipientHolders.publicKey.toBase58(), // fee_recipient_holders
      feeHoldersWsolTokenAccount: feeHoldersWsolTokenAccount.toBase58(), // fee_holders_wsol_token_account
    });

    const initializeExtraAccountMetaListInstruction = await program.methods
      .initializeExtraAccountMetaList(
        FEE_PERCENT_HOLDERS,
        FEE_PERCENT_MARKETING,
        FEE_PERCENT_LIQUIDITY
      )
      .accounts({
        payer: wallet.publicKey, // payer
        extraAccountMetaList: extraAccountMetaListPDA, // extra_account_meta_list
        mint: mint, // mint
        tokenProgram: TOKEN_PROGRAM_ID, // token_program
        tokenProgramOrg: TOKEN_2022_PROGRAM_ID, // token_program
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, // associated_token_program
        systemProgram: SystemProgram.programId, // system_program
        feeConfig: feeConfigPDA, // fee_config
        treasury, // treasury
        wsolMint: NATIVE_MINT, // wsol_mint
        feeWsolTokenAccount, // fee_wsol_token_account
        wrapperMint, // wrapper_mint
        feeWrapperTokenAccount, // fee_wrapper_token_account
        feeRecipientLiquidity: feeRecipientLiquidity.publicKey, // fee_recipient_liquidity
        feeLiquidityWsolTokenAccount, // fee_liquidity_wsol_token_account
        feeRecipientMarketing: feeRecipientMarketing.publicKey, // fee_recipient_marketing
        feeMarketingWsolTokenAccount, // fee_marketing_wsol_token_account
        feeRecipientHolders: feeRecipientHolders.publicKey, // fee_recipient_holders
        feeHoldersWsolTokenAccount, // fee_holders_wsol_token_account
      })
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
  let sourceTokenAccount: PublicKey;

  // Recipient token account address
  const recipient = Keypair.generate();
  let destinationTokenAccount: PublicKey;

  it("Prepare for transfer", async () => {
    // airdrop SOL to accounts
    const signature = await connection.requestAirdrop(
      new PublicKey(sender.publicKey),
      100 * 10 ** 9
    );
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      {
        blockhash,
        lastValidBlockHeight,
        signature,
      },
      "processed"
    );

    sourceTokenAccount = getAssociatedTokenAddressSync(
      mint,
      sender.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    destinationTokenAccount = getAssociatedTokenAddressSync(
      mint,
      recipient.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // 100 tokens
    const amount = 100 * 10 ** decimals;

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        sourceTokenAccount,
        sender.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destinationTokenAccount,
        recipient.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mint,
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

  it("Transfer Token", async () => {
    const amount = 1 * 10 ** decimals;
    const bigIntAmount = BigInt(amount);
    const balanceSourceBefore = await getTokenBalance(sourceTokenAccount);
    const balanceDestinationBefore = await getTokenBalance(destinationTokenAccount);
    console.log({ balanceSourceBefore, balanceDestinationBefore });

    // Standard token transfer instruction
    const transferInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        connection, // connection: Connection,
        sourceTokenAccount, // source: PublicKey,
        mint, // mint: PublicKey,
        destinationTokenAccount, // destination: PublicKey,
        sender.publicKey, // owner: PublicKey,
        bigIntAmount, // amount: bigint,
        decimals, // decimals: number,
        [sender.publicKey], // multiSigners: (Signer | PublicKey)[] = [],
        "confirmed", // commitment?: Commitment,
        TOKEN_2022_PROGRAM_ID // programId = TOKEN_PROGRAM_ID
      );

    const transaction = new Transaction().add(transferInstruction);

    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [sender],
      { skipPreflight: true }
    );
    PUT_LOG && console.log("Transfer Signature:", txSig);

    const balanceSourceAfter = await getTokenBalance(sourceTokenAccount);
    const balanceDestinationAfter = await getTokenBalance(destinationTokenAccount);
    console.log({ balanceSourceAfter, balanceDestinationAfter });

    const wrapperBalance = await getTokenBalance(feeWrapperTokenAccount);
    console.log({ wrapperBalance });
  });

  const getTokenBalance = async (
    tokenAccount: PublicKey,
    programId: PublicKey = TOKEN_2022_PROGRAM_ID
  ) => {
    return (await getAccount(connection, tokenAccount, "processed", programId))
      .amount;
  };
});
