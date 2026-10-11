// Starting guesses for the Overview funnel's plain-words hint — not derived
// from Archivist's real numbers, just reasonable defaults. Edit these two if
// they don't match what's normal for this business.
export const FUNNEL_THRESHOLDS = {
  /** Below this, hint that few visitors are starting checkout at all. */
  viewsToCheckoutPercent: 3,
  /** Below this, hint that people start checkout but don't pay. */
  checkoutToPaidPercent: 40,
};

export function funnelHint(
  viewsToCheckoutPercent: number | null,
  checkoutToPaidPercent: number | null,
): string {
  if (viewsToCheckoutPercent !== null && viewsToCheckoutPercent < FUNNEL_THRESHOLDS.viewsToCheckoutPercent) {
    return "Few visitors start checkout: look at the page, price or ad match.";
  }
  if (checkoutToPaidPercent !== null && checkoutToPaidPercent < FUNNEL_THRESHOLDS.checkoutToPaidPercent) {
    return "Many start checkout but don't pay: look at payment or delivery.";
  }
  if (viewsToCheckoutPercent === null && checkoutToPaidPercent === null) {
    return "Not enough data yet to judge the funnel.";
  }
  return "Funnel looks healthy.";
}
