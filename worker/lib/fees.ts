// Assumptions behind "estimated profit per sale" on the admin dashboard.
// Both are editable here — there is no UI for them, on purpose: changing the
// fee/GST assumption is a rare, deliberate edit, not a thing to expose a
// button for. The dashboard displays these two numbers next to the profit
// figure they drive, so "estimated" never hides what it's estimating from.
//
// Razorpay's standard domestic rate (UPI/cards) is ~2% as of this writing;
// GST (18%) applies on top of the fee itself, not on the sale amount.
// Adjust both if your actual Razorpay plan differs.
export const PAYMENT_FEE_PERCENT = 2.0;
export const GST_ON_FEE_PERCENT = 18.0;

export interface FeeAssumptions {
  paymentFeePercent: number;
  gstOnFeePercent: number;
}

export const feeAssumptions: FeeAssumptions = {
  paymentFeePercent: PAYMENT_FEE_PERCENT,
  gstOnFeePercent: GST_ON_FEE_PERCENT,
};

/** Revenue actually kept after Razorpay's fee and GST on that fee, in paise. */
export function netOfPaymentFees(amountPaise: number): number {
  const feePaise = amountPaise * (PAYMENT_FEE_PERCENT / 100);
  const gstPaise = feePaise * (GST_ON_FEE_PERCENT / 100);
  return amountPaise - feePaise - gstPaise;
}
