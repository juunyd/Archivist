import { supportEmail } from "./env";

// Archivist house style, ported for email: black on white, one typeface
// stack, no ornament. Table-based layout and inline CSS throughout — Gmail,
// Outlook (Word rendering engine) and Apple Mail all strip <style> blocks or
// mangle CSS classes to different degrees, so nothing here relies on either.

const escapeHtml = (value: string): string =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const FONT_STACK = `-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif`;

function formatRupees(amountPaise: number): string {
  const rupees = amountPaise / 100;
  return rupees.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

/**
 * The invisible preview line Gmail/Apple Mail show next to the subject in
 * the inbox list. Padded with zero-width joiners so trailing whitespace
 * doesn't get filled in with the start of the visible body instead.
 */
const preheader = (text: string): string => `
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;font-size:1px;line-height:1px;color:#ffffff;">
    ${escapeHtml(text)}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>`;

const shell = (opts: { preheaderText: string; bodyHtml: string }): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title></title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
${preheader(opts.preheaderText)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${FONT_STACK};color:#111111;">
          <tr>
            <td style="padding-bottom:24px;border-bottom:2px solid #111111;">
              <span style="font-size:15px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Archivist</span>
            </td>
          </tr>
          <tr><td style="padding-top:32px;">${opts.bodyHtml}</td></tr>
          <tr>
            <td style="padding-top:40px;margin-top:8px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.7;color:#777777;">
              <p style="margin:16px 0 6px;font-weight:700;color:#111111;">Archivist</p>
              <p style="margin:0 0 6px;"><a href="https://archivist.in" style="color:#777777;text-decoration:underline;">archivist.in</a></p>
              <p style="margin:0;">This is an order confirmation for a purchase you made — not a marketing email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/**
 * Bulletproof-ish button: the background and padding live on the <td>, not
 * just the <a>, because Outlook's Word rendering engine honors table-cell
 * padding far more reliably than anchor padding. Comfortably clears the
 * 44px tap-target minimum (15px padding x2 + 20px line-height = 50px).
 */
const button = (href: string, label: string): string => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
  <tr>
    <td align="center" bgcolor="#111111" style="background-color:#111111;border-radius:4px;padding:0;">
      <a href="${escapeHtml(href)}" target="_blank" style="display:block;padding:15px 32px;font-family:${FONT_STACK};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;mso-padding-alt:0;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;

/** The plain-URL fallback directly under every button — the #1 support request for a broken button. */
const plainLinkFallback = (url: string): string => `
<p style="margin:0 0 28px;font-size:13px;line-height:1.6;color:#777777;">
  Button not working? Copy and paste this link into your browser:<br>
  <a href="${escapeHtml(url)}" style="color:#111111;word-break:break-all;">${escapeHtml(url)}</a>
</p>`;

const coverImage = (coverUrl: string | null | undefined, alt: string): string =>
  coverUrl
    ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr>
    <td><img src="${escapeHtml(coverUrl)}" width="120" alt="${escapeHtml(alt)}" style="display:block;width:120px;height:auto;border:1px solid #e5e5e5;"></td>
  </tr>
</table>`
    : "";

const P = `margin:0 0 24px;font-size:16px;line-height:1.6;color:#111111;`;

export interface DeliveryEmailInput {
  guideTitle: string;
  downloadUrl: string;
  orderId: string;
  amountPaise: number;
  paidAt: string;
  coverUrl?: string | null;
}

export function deliveryEmail(input: DeliveryEmailInput) {
  const title = escapeHtml(input.guideTitle);
  const orderId = escapeHtml(input.orderId);
  const dateLabel = formatDate(input.paidAt);
  const amountLabel = formatRupees(input.amountPaise);

  const summaryRow = (label: string, value: string): string => `
  <tr>
    <td style="padding:9px 0;font-size:13px;line-height:1.5;color:#777777;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:9px 0;font-size:13px;line-height:1.5;color:#111111;font-weight:600;vertical-align:top;">${value}</td>
  </tr>`;

  return {
    subject: `Your guide is ready: ${input.guideTitle}`,
    html: shell({
      preheaderText: `Download ${input.guideTitle} — your link stays active, so you can come back to it any time.`,
      bodyHtml: `
      <p style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;">Order confirmed.</p>
      <p style="${P}">Thank you for your order. <strong>${title}</strong> is ready to download.</p>
      ${coverImage(input.coverUrl, `${input.guideTitle} cover`)}
      ${button(input.downloadUrl, "Download the PDF")}
      ${plainLinkFallback(input.downloadUrl)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5;">
        ${summaryRow("Guide", title)}
        ${summaryRow("Order ID", orderId)}
        ${summaryRow("Date", escapeHtml(dateLabel))}
        ${summaryRow("Amount paid", `&#8377;${escapeHtml(amountLabel)}`)}
        ${summaryRow("Format", "PDF")}
      </table>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#111111;">
        This link keeps working, so you can download the guide again whenever you need it.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#666666;">
        Questions, or trouble opening your guide? Write to <a href="mailto:${supportEmail}" style="color:#111111;">${supportEmail}</a>.
      </p>`,
    }),
    text: [
      `Order confirmed.`,
      ``,
      `Thank you for your order. ${input.guideTitle} is ready to download.`,
      ``,
      `Download the PDF:`,
      input.downloadUrl,
      ``,
      `Order summary`,
      `Guide: ${input.guideTitle}`,
      `Order ID: ${input.orderId}`,
      `Date: ${dateLabel}`,
      `Amount paid: ₹${amountLabel}`,
      `Format: PDF`,
      ``,
      `This link keeps working, so you can download the guide again whenever you need it.`,
      ``,
      `Questions, or trouble opening your guide? Write to ${supportEmail}.`,
      ``,
      `Archivist`,
      `archivist.in`,
      `This is an order confirmation, not a marketing email.`,
    ].join("\n"),
  };
}

export interface DownloadLinkItem {
  guideTitle: string;
  downloadUrl: string;
  coverUrl?: string | null;
}

export function downloadLinksEmail(items: DownloadLinkItem[]) {
  const plural = items.length !== 1;

  const itemsHtml = items
    .map(
      (item, index) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;${index > 0 ? "padding-top:24px;border-top:1px solid #e5e5e5;" : ""}">
        <tr>
          <td>
            ${coverImage(item.coverUrl, `${item.guideTitle} cover`)}
            <p style="margin:0 0 14px;font-size:17px;line-height:1.4;font-weight:700;">${escapeHtml(item.guideTitle)}</p>
            ${button(item.downloadUrl, "Download the PDF")}
            ${plainLinkFallback(item.downloadUrl)}
          </td>
        </tr>
      </table>`,
    )
    .join("");

  const itemsText = items.flatMap((item) => [
    item.guideTitle,
    `Download the PDF:`,
    item.downloadUrl,
    ``,
  ]);

  return {
    subject: "Your Archivist download links",
    html: shell({
      preheaderText: plural
        ? "Download your guides — these links stay active, so you can come back to them any time."
        : `Download ${items[0]?.guideTitle ?? "your guide"} — your link stays active, so you can come back to it any time.`,
      bodyHtml: `
      <p style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;">Your download ${plural ? "links" : "link"}.</p>
      <p style="${P}">Here ${plural ? "are the guides" : "is the guide"} you have bought from Archivist.</p>
      ${itemsHtml}
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#111111;">
        These links keep working — no need to request them again.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#666666;">
        Questions, or trouble opening your guide? Write to <a href="mailto:${supportEmail}" style="color:#111111;">${supportEmail}</a>.
      </p>`,
    }),
    text: [
      `Here ${plural ? "are the guides" : "is the guide"} you have bought from Archivist.`,
      ``,
      ...itemsText,
      `These links keep working — no need to request them again.`,
      ``,
      `Questions, or trouble opening your guide? Write to ${supportEmail}.`,
      ``,
      `Archivist`,
      `archivist.in`,
      `This is an order confirmation, not a marketing email.`,
    ].join("\n"),
  };
}
