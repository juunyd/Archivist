// Shared between every buy button on the guide page and the mobile sticky
// bar, so the default and the "what counts as custom" rule can't drift
// between them. The price is never part of this string — callers append it
// themselves from guide.price, which is always sourced server-side.
export const DEFAULT_BUTTON_TEXT = "Get Instant Access";
export const BUTTON_TEXT_MAX_LENGTH = 30;

export function resolveButtonText(buttonText: string | undefined): string {
  const trimmed = buttonText?.trim();
  return trimmed ? trimmed : DEFAULT_BUTTON_TEXT;
}

/**
 * The sticky bar is narrow and shows the price separately, so a long custom
 * label is cut to its first few words instead of wrapping or overflowing.
 * The default label ("Get Instant Access", 19 chars) is well under the
 * threshold, so the four existing guides render unchanged.
 */
export function compactButtonText(text: string, maxChars = 20, maxWords = 3): string {
  if (text.length <= maxChars) return text;
  return text.trim().split(/\s+/).slice(0, maxWords).join(" ");
}
