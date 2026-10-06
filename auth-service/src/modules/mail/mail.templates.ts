interface EmailTemplate {
  brand: string;
  title: string;
  intro: string;
  cta: string;
  link: string;
  footer: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Single transactional template: table layout + inline styles so it renders
 * consistently in Gmail/Outlook, with the raw link as a plain-text fallback.
 */
export function renderEmail(t: EmailTemplate): string {
  const title = escapeHtml(t.title);
  const intro = escapeHtml(t.intro);
  const cta = escapeHtml(t.cta);
  const footer = escapeHtml(t.footer);
  const brand = escapeHtml(t.brand);
  const link = escapeHtml(t.link);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:28px 32px 0;font-size:20px;font-weight:700;color:#4f46e5;">${brand}</td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;font-size:22px;font-weight:700;line-height:1.3;">${title}</td>
          </tr>
          <tr>
            <td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#374151;">${intro}</td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;">${cta}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;font-size:13px;line-height:1.6;color:#6b7280;">
              If the button doesn't work, copy this link into your browser:<br>
              <a href="${link}" style="color:#4f46e5;word-break:break-all;">${link}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;font-size:12px;line-height:1.6;color:#9ca3af;border-top:1px solid #f3f4f6;">${footer}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
