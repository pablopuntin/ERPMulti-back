export type AccountStatement = {
  customerId: string;
  branchId: string;
  rawBalance: number;
  debtAmount: number;
  creditAmount: number;
  lastMovementAt: Date | null;
};

export const toAccountStatement = (params: {
  customerId: string;
  branchId: string;
  rawBalance: number;
  lastMovementAt: Date | null;
}): AccountStatement => {
  const rawBalance = Number(params.rawBalance || 0);

  return {
    customerId: params.customerId,
    branchId: params.branchId,
    rawBalance,
    debtAmount: rawBalance > 0 ? rawBalance : 0,
    creditAmount: rawBalance < 0 ? Math.abs(rawBalance) : 0,
    lastMovementAt: params.lastMovementAt
  };
};
