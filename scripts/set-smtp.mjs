// Configure Supabase to send auth emails (OTP codes) via SMTP.
// Reads from ../.env.local — for Gmail / Google Workspace:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=info@lrghomes.com
//   SMTP_PASS=<16-char Google App Password>
//   SMTP_SENDER=info@lrghomes.com
// Usage: node scripts/set-smtp.mjs
import { patchAuthConfig, getAuthConfig } from './sb.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const env = {};
for (const line of readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
}
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER } = env;
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_SENDER) {
  console.error('Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER in .env.local first');
  process.exit(1);
}

await patchAuthConfig({
  smtp_host: SMTP_HOST,
  smtp_port: String(SMTP_PORT || 587),
  smtp_user: SMTP_USER,
  smtp_pass: SMTP_PASS,
  smtp_admin_email: SMTP_SENDER,
  smtp_sender_name: 'Physiq',
  rate_limit_email_sent: 30,   // built-in cap was 2/hr; real SMTP can do far more
  smtp_max_frequency: 1,
});

const c = await getAuthConfig();
const ok = c.smtp_host === SMTP_HOST && c.smtp_admin_email === SMTP_SENDER;
console.log('SMTP config applied:', ok ? 'OK ✓' : 'MISMATCH ✗');
console.log('  host =', c.smtp_host, '| user =', c.smtp_user, '| sender =', c.smtp_admin_email, '| rate/hr =', c.rate_limit_email_sent);
if (!ok) process.exit(1);
