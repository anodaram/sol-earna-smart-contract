import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMint,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import {
  use as chaiUse,
  assert as assert_true
} from 'chai'
import { assert_eq } from 'mocha-as-assert'
import chaiAsPromised from 'chai-as-promised'
import { Wrapper } from "../target/types/wrapper";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";

chaiUse(chaiAsPromised);

describe('wrapper', () => {
  // Constants
  const TREASURY_TAG = Buffer.from("treasury");
  const TREASURY_TOKEN_ACCOUNT_TAG = Buffer.from("treasury-token-account");
  const WRAPPER_MINT_TAG = Buffer.from("wrapper-mint");
  const USER_WRAPPER_TOKEN_ACCOUNT_TAG = Buffer.from("user-wrapper-token-account");

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Wrapper as anchor.Program<Wrapper>;
  const programId = program.programId;

  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  const treasuryAdmin = wallet.publicKey;
  const userKeypair = new Keypair();
  const user = userKeypair.publicKey;
  let treasuryTokenMint: PublicKey = null;
  const mintAmount = 10_000_000_000_000; // 10000 POS

  let userTreasuryTokenAccount: PublicKey;
  let listenerCreated, listenerDeposited, listenerClaimed;

  before(() => {
    listenerCreated = program.addEventListener("TreasuryCreated", (event, slot) => {
      console.log("TreasuryCreated emited: ", event);
    });
    listenerDeposited = program.addEventListener("Deposited", (event, slot) => {
      console.log("Deposited emited: ", event);
    });
    listenerClaimed = program.addEventListener("Claimed", (event, slot) => {
      console.log("Claimed emited: ", event);
    });
  });

  it('Is Initialize!', async () => {
    console.log("treasuryAdmin", treasuryAdmin.toBase58());
    console.log("user", user.toBase58());

    await safeAirdrop(program.provider.connection, treasuryAdmin, 1000000000);
    await safeAirdrop(program.provider.connection, user, 1000000000);

    treasuryTokenMint = await createMint(
      program.provider.connection,
      wallet.payer,
      treasuryAdmin,
      null,
      9
    );
    console.log("treasuryTokenMint", treasuryTokenMint.toBase58());

    userTreasuryTokenAccount = getAssociatedTokenAddressSync(
      treasuryTokenMint,
      user,
      false
    );

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        treasuryAdmin,
        userTreasuryTokenAccount,
        user,
        treasuryTokenMint
      ),
      createMintToInstruction(
        treasuryTokenMint,
        userTreasuryTokenAccount,
        treasuryAdmin,
        mintAmount
      )
    );

    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true }
    );
    console.log(`Transaction Signature: ${txSig}`);
  });

  let wrapperMint: PublicKey = null;
  it('CreateTreasury !', async () => {
    const treasury = await pda([TREASURY_TAG, treasuryTokenMint.toBuffer(), treasuryAdmin.toBuffer()], programId);
    const treasuryTokenAccount = await pda([TREASURY_TOKEN_ACCOUNT_TAG, treasury.toBuffer()], programId);
    wrapperMint = await pda([WRAPPER_MINT_TAG, treasury.toBuffer()], programId);

    const txSig = await program.methods.createTreasury().accounts({
      treasury,
      treasuryMint: treasuryTokenMint,
      wrapperMint,
      treasuryTokenAccount,
      authority: treasuryAdmin,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([wallet.payer]).rpc();

    console.log(`Transaction Signature: ${txSig}`);

    const treasuryData = await program.account.treasury.fetch(treasury);
    assert_eq(treasuryData.authority, treasuryAdmin);
    assert_true(treasuryData.treasuryMint.equals(treasuryTokenMint), "treasuryMint");
    assert_true(treasuryData.treasuryTokenAccount.equals(treasuryTokenAccount), "treasuryTokenAccount");
    assert_true(treasuryData.wrapperMint.equals(wrapperMint), "wrapperMint");
  });

  const stakeAmount = 100_000_000_000; //100 POS
  it('Stake !', async () => {
    const treasury = await pda([TREASURY_TAG, treasuryTokenMint.toBuffer(), treasuryAdmin.toBuffer()], programId);
    const treasuryTokenAccount = await pda([TREASURY_TOKEN_ACCOUNT_TAG, treasury.toBuffer()], programId);
    const wrapperMint = await pda([WRAPPER_MINT_TAG, treasury.toBuffer()], programId);
    const userWrapperTokenAccount = await pda([USER_WRAPPER_TOKEN_ACCOUNT_TAG, wrapperMint.toBuffer(), user.toBuffer()], programId);
    const treasuryAmountBefore = (await getAccount(connection, treasuryTokenAccount)).amount
    let userPosAmountBefore = BigInt(0);
    try {
      userPosAmountBefore = (await getAccount(connection, userWrapperTokenAccount)).amount;
    } catch (e) { }

    const txSig = await program.methods.stake(new anchor.BN(stakeAmount)).accounts({
      treasury,
      wrapperMint,
      treasuryMint: treasuryTokenMint,
      treasuryTokenAccount,
      userTokenAccount: userTreasuryTokenAccount,
      userWrapperTokenAccount,
      user,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([userKeypair]).rpc();
    console.log(`Transaction Signature: ${txSig}`);

    let treasuryAmountAfter = (await getAccount(connection, treasuryTokenAccount)).amount;
    let userPosAmountAfter = (await getAccount(connection, userWrapperTokenAccount)).amount;
    assert_true(treasuryAmountAfter - treasuryAmountBefore === BigInt(stakeAmount), "stakeAmount treasury");
    assert_true(userPosAmountAfter - userPosAmountBefore === BigInt(stakeAmount), "stakeAmount userPos");
  });

  const redeemAmount = 10_000_000_000; //10 POS
  it('Redeem !', async () => {
    const treasury = await pda([TREASURY_TAG, treasuryTokenMint.toBuffer(), treasuryAdmin.toBuffer()], programId);
    const treasuryTokenAccount = await pda([TREASURY_TOKEN_ACCOUNT_TAG, treasury.toBuffer()], programId);
    const wrapperMint = await pda([WRAPPER_MINT_TAG, treasury.toBuffer()], programId);
    const userWrapperTokenAccount = await pda([USER_WRAPPER_TOKEN_ACCOUNT_TAG, wrapperMint.toBuffer(), user.toBuffer()], programId);
    let treasuryAmountBefore = (await getAccount(connection, treasuryTokenAccount)).amount;
    let userPosAmountBefore = (await getAccount(connection, userWrapperTokenAccount)).amount;

    const txSig = await program.methods.redeem(new anchor.BN(redeemAmount)).accounts({
      treasury,
      treasuryMint: treasuryTokenMint,
      wrapperMint,
      treasuryTokenAccount,
      userTokenAccount: userTreasuryTokenAccount,
      userWrapperTokenAccount,
      user,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([userKeypair]).rpc();
    console.log(`Transaction Signature: ${txSig}`);

    let treasuryAmountAfter = (await getAccount(connection, treasuryTokenAccount)).amount;
    let userPosAmountAfter = (await getAccount(connection, userWrapperTokenAccount)).amount;
    assert_true(treasuryAmountBefore - treasuryAmountAfter === BigInt(redeemAmount), "redeemAmount treasury");
    assert_true(userPosAmountBefore - userPosAmountAfter === BigInt(redeemAmount), "redeemAmount userPos");
  });

  after(() => {
    try {
      program.removeEventListener(listenerCreated);
      program.removeEventListener(listenerDeposited);
      program.removeEventListener(listenerClaimed);
    } catch { }
  });
});


async function safeAirdrop(connection: anchor.web3.Connection, destination: anchor.web3.PublicKey, amount = 100000000) {
  while (await connection.getBalance(destination) < amount) {
    try {
      // Request Airdrop for user
      await connection.confirmTransaction(
        await connection.requestAirdrop(destination, 100000000),
        "confirmed"
      );
    } catch { }

  };
}

async function pda(seeds: (Buffer | Uint8Array)[], programId: anchor.web3.PublicKey) {
  const [pdaKey] =
    await anchor.web3.PublicKey.findProgramAddress(
      seeds,
      programId,
    );
  return pdaKey;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
