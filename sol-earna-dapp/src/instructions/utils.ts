import { BN } from "@project-serum/anchor";

// TODO: need to check these functions for rest
export const bigintToNumber = (_amount: bigint | BN, decimals: number = 9): number => {
  const amount: bigint = _amount instanceof BN ? BigInt(_amount.toNumber()) : _amount;
  const convertedAmount = amount / 10n ** BigInt(decimals);
  const rest = amount % 10n ** BigInt(decimals);
  return Number(convertedAmount) + Number(rest) / 10 ** decimals;
};

export const numberToBigint = (amount: number, decimals: number = 9): bigint => {
  const amountFloor = Math.floor(amount);
  const amountRest = amount - amountFloor;
  return BigInt(amountFloor) * BigInt(10 ** decimals) + BigInt(Math.floor(amountRest * 10 ** decimals));
};

export const numberToBN = (amount: number, decimals: number = 9): BN => {
  const convertedAmount = numberToBigint(amount, decimals);
  return new BN(convertedAmount.toString());
};
