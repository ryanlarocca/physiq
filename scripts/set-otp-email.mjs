// Phase 1 — configure Supabase email auth for 6-digit OTP code login (no links).
// Sets BOTH the magic-link (existing users) and confirmation (new signups) templates
// to render {{ .Token }}, so signInWithOtp works for new + returning + stuck-unconfirmed users.
// Re-runnable / idempotent. Usage: node scripts/set-otp-email.mjs
import { patchAuthConfig, getAuthConfig } from './sb.mjs';

const SUBJECT = 'Your Physiq login code';
const TEMPLATE = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:440px;margin:0 auto;padding:32px;text-align:center">
  <h2 style="color:#333;margin:0 0 8px">Your Physiq login code</h2>
  <p style="color:#666;margin:0 0 24px">Enter this code in the app to sign in.</p>
  <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#667eea;background:#f4f4fb;border-radius:12px;padding:18px 0">{{ .Token }}</div>
  <p style="color:#999;font-size:13px;margin:24px 0 0">This code expires in 1 hour. If you didn't request it, you can ignore this email.</p>
</div>`;

const patch = {
  mailer_otp_length: 6,
  mailer_otp_exp: 3600,
  mailer_subjects_magic_link: SUBJECT,
  mailer_templates_magic_link_content: TEMPLATE,
  mailer_subjects_confirmation: SUBJECT,
  mailer_templates_confirmation_content: TEMPLATE,
};

await patchAuthConfig(patch);

// Verify it took
const c = await getAuthConfig();
const ok =
  c.mailer_otp_length === 6 &&
  c.mailer_templates_magic_link_content.includes('{{ .Token }}') &&
  c.mailer_templates_confirmation_content.includes('{{ .Token }}');
console.log('OTP email config applied:', ok ? 'OK ✓' : 'MISMATCH ✗');
console.log('  otp_length =', c.mailer_otp_length);
console.log('  magic_link subject =', JSON.stringify(c.mailer_subjects_magic_link));
console.log('  magic_link has {{ .Token }} =', c.mailer_templates_magic_link_content.includes('{{ .Token }}'));
console.log('  confirmation has {{ .Token }} =', c.mailer_templates_confirmation_content.includes('{{ .Token }}'));
if (!ok) process.exit(1);
