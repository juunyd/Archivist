import { supportEmail } from "./env";

// Unchanged from the old Supabase Edge Functions.

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Archivist house style: black on white, one typeface, no ornament.
const shell = (bodyHtml: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111;">
          <tr>
            <td style="padding-bottom:28px;border-bottom:1px solid #111111;">
              <span style="font-size:15px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;">Archivist</span>
            </td>
          </tr>
          <tr><td style="padding-top:28px;">${bodyHtml}</td></tr>
          <tr>
            <td style="padding-top:36px;margin-top:36px;border-top:1px solid #e5e5e5;font-size:13px;line-height:1.6;color:#666666;">
              Trouble opening your guide, or charged twice? Reply to this email or write to
              <a href="mailto:${supportEmail}" style="color:#111111;">${supportEmail}</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const button = (href: string, label: string): string =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 26px;">${escapeHtml(label)}</a>`;

const P = `margin:0 0 16px;font-size:16px;line-height:1.6;color:#111111;`;

export function deliveryEmail(input: { guideTitle: string; downloadUrl: string }) {
  const title = escapeHtml(input.guideTitle);
  return {
    subject: `Your copy of ${input.guideTitle}`,
    html: shell(`
      <p style="${P}">Your copy of <strong>${title}</strong> is ready.</p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#111111;">Download the PDF from the link below.</p>
      <p style="margin:0 0 28px;">${button(input.downloadUrl, "Download the PDF")}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#666666;">
        Keep this email — the link works again whenever you need it, on any device.
      </p>`),
    text: [
      `Your copy of ${input.guideTitle} is ready.`,
      ``,
      `Download the PDF here:`,
      input.downloadUrl,
      ``,
      `Keep this email — the link works again whenever you need it, on any device.`,
      ``,
      `Trouble opening your guide, or charged twice? Reply to this email or write to ${supportEmail}.`,
      ``,
      `Archivist`,
    ].join("\n"),
  };
}

export function downloadLinksEmail(
  items: { guideTitle: string; downloadUrl: string }[],
) {
  const rows = items.map((item) => `
      <p style="margin:0 0 10px;font-size:16px;line-height:1.5;"><strong>${escapeHtml(item.guideTitle)}</strong></p>
      <p style="margin:0 0 28px;">${button(item.downloadUrl, "Download the PDF")}</p>`).join("");
  return {
    subject: items.length === 1 ? "Your Archivist download link" : "Your Archivist download links",
    html: shell(`
      <p style="${P}">Here ${items.length === 1 ? "is the guide" : "are the guides"} you have bought from Archivist.</p>
      <div style="margin-top:28px;">${rows}</div>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#666666;">
        These links keep working — no need to request them again.
      </p>`),
    text: [
      `Here ${items.length === 1 ? "is the guide" : "are the guides"} you have bought from Archivist.`,
      ``,
      ...items.flatMap((item) => [item.guideTitle, item.downloadUrl, ``]),
      `These links keep working — no need to request them again.`,
      ``,
      `Questions? Write to ${supportEmail}.`,
      ``,
      `Archivist`,
    ].join("\n"),
  };
}
