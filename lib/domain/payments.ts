export type PaymentAmounts = { status: string; expectedCents: number; receivedCents: number };

export function paymentTotals(payments: PaymentAmounts[]) {
  return payments.reduce((total, payment) => ({
    collected: total.collected + payment.receivedCents,
    outstanding: total.outstanding + (payment.status === "WAIVED" ? 0 : Math.max(0, payment.expectedCents - payment.receivedCents)),
  }), { collected: 0, outstanding: 0 });
}
