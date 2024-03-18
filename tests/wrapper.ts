import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
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
  Connection,
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
  const TREASURY_VAULT_TAG = Buffer.from("treasury-vault");
  const POS_MINT_TAG = Buffer.from("pos-mint");
  const USER_POS_VAULT_TAG = Buffer.from("user-pos-vault");

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

  let userTreasuryVault: PublicKey;
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

    userTreasuryVault = getAssociatedTokenAddressSync(
      treasuryTokenMint,
      user,
      false
    );

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        treasuryAdmin,
        userTreasuryVault,
        user,
        treasuryTokenMint
      ),
      createMintToInstruction(
        treasuryTokenMint,
        userTreasuryVault,
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

  let posMint: PublicKey = null;
  it('CreateTreasury !', async () => {
    const treasury = await pda([TREASURY_TAG, treasuryTokenMint.toBuffer(), treasuryAdmin.toBuffer()], programId);
    const treasuryVault = await pda([TREASURY_VAULT_TAG, treasury.toBuffer()], programId);
    posMint = await pda([POS_MINT_TAG, treasury.toBuffer()], programId);

    const txSig = await program.methods.createTreasury().accounts({
      treasury,
      treasuryMint: treasuryTokenMint,
      posMint,
      treasuryVault,
      authority: treasuryAdmin,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([wallet.payer]).rpc();

    console.log(`Transaction Signature: ${txSig}`);

    const treasuryData = await program.account.treasury.fetch(treasury);
    assert_eq(treasuryData.authority, treasuryAdmin);
    assert_true(treasuryData.treasuryMint.equals(treasuryTokenMint), "treasuryMint");
    assert_true(treasuryData.treasuryVault.equals(treasuryVault), "treasuryVault");
    assert_true(treasuryData.posMint.equals(posMint), "posMint");
  });

  const stakeAmount = 100_000_000_000; //100 POS
  it('Stake !', async () => {
    const treasury = await pda([TREASURY_TAG, treasuryTokenMint.toBuffer(), treasuryAdmin.toBuffer()], programId);
    const treasuryVault = await pda([TREASURY_VAULT_TAG, treasury.toBuffer()], programId);
    const posMint = await pda([POS_MINT_TAG, treasury.toBuffer()], programId);
    const userPosVault = await pda([USER_POS_VAULT_TAG, posMint.toBuffer(), user.toBuffer()], programId);
    const treasuryAmountBefore = (await getAccount(connection, treasuryVault)).amount
    let userPosAmountBefore = BigInt(0);
    try {
      userPosAmountBefore = (await getAccount(connection, userPosVault)).amount;
    } catch (e) { }

    const txSig = await program.methods.stake(new anchor.BN(stakeAmount)).accounts({
      treasury,
      posMint,
      treasuryMint: treasuryTokenMint,
      treasuryVault,
      userVault: userTreasuryVault,
      userPosVault,
      authority: user,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY
    }).signers([userKeypair]).rpc();
    console.log(`Transaction Signature: ${txSig}`);

    let treasuryAmountAfter = (await getAccount(connection, treasuryVault)).amount;
    let userPosAmountAfter = (await getAccount(connection, userPosVault)).amount;
    assert_true(treasuryAmountAfter - treasuryAmountBefore === BigInt(stakeAmount), "stakeAmount treasury");
    assert_true(userPosAmountAfter - userPosAmountBefore === BigInt(stakeAmount), "stakeAmount userPos");
  });

  const redeemAmount = 10_000_000_000; //10 POS
  it('Redeem !', async () => {
    const treasury = await pda([TREASURY_TAG, treasuryTokenMint.toBuffer(), treasuryAdmin.toBuffer()], programId);
    const treasuryVault = await pda([TREASURY_VAULT_TAG, treasury.toBuffer()], programId);
    const posMint = await pda([POS_MINT_TAG, treasury.toBuffer()], programId);
    const userPosVault = await pda([USER_POS_VAULT_TAG, posMint.toBuffer(), user.toBuffer()], programId);
    let treasuryAmountBefore = (await getAccount(connection, treasuryVault)).amount;
    let userPosAmountBefore = (await getAccount(connection, userPosVault)).amount;

    const txSig = await program.methods.redeem(new anchor.BN(redeemAmount)).accounts({
      treasury,
      treasuryMint: treasuryTokenMint,
      posMint,
      treasuryVault,
      userVault: userTreasuryVault,
      userPosVault,
      authority: user,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([userKeypair]).rpc();
    console.log(`Transaction Signature: ${txSig}`);

    let treasuryAmountAfter = (await getAccount(connection, treasuryVault)).amount;
    let userPosAmountAfter = (await getAccount(connection, userPosVault)).amount;
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
