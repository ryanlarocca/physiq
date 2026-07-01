# Physiq – Status

**Last Updated:** July 1, 2026  
**Status:** ✅ LIVE at https://ryanlarocca.github.io/physiq/  
**Changelog:** [CHANGELOG.md](./CHANGELOG.md)

## 📍 Where we left off
- **Now —** **Launched & shareable at https://ryanlarocca.github.io/physiq/.** Passwordless email-OTP login (6-digit code, no link); isolated per-user data (Supabase RLS by `user_id`); AI food logging (text + photo) on the **Anthropic API directly** (Claude Sonnet 4.6) behind a **JWT-gated** `physiq-api` proxy. **OTP email now sends via Gmail SMTP** (`ryan@lrghomes.com` app password; rate cap raised 2→30/hr) — the built-in Supabase email was capped at 2/hr and would have silently failed for real users. **Telegram login alerts** fire on every real login (gated `notify-login` endpoint → existing alerts bot). **Install-Physiq banner** guides iOS/Android users to add it to the home screen. SW at `v8`.
- **🏋️ Gym Tracker (LIVE in the app, gated to Ryan) —** Shipped into `index.html` behind a `GYM_BETA_USERS` allowlist (Ryan's id only). The 🏋️ nav tab appears for him alone; all other users see no change (RLS + `authenticated`-only grants keep data isolated). Strength cards (PR + e1RM sparkline) · log w/ voice · top voice quick-log · Cardio · **Stats** (DOTS + relative-strength tiers + strength-vs-bodyweight chart). Reads its data via `sbFetch` under the user's JWT. Verified `scripts/test-gym.mjs` 11/11. SW `v9`. See CHANGELOG 2026-07-01.
- **Next —** Re-ping the 3 stuck testers (jan/chris/larry) — they can now log in via OTP. **Gym Tracker:** Ryan does critical testing on his phone; to add testers, drop their id into `GYM_BETA_USERS` (or build a `user_features` table for no-redeploy toggles). Optional later: a dedicated pretty domain (see below).
- **Blockers / open —** Fix the broken `com.physiq.weight-sync` launchd job (points at a missing `sync-weights.sh`). **Custom domain deferred:** `physiq.lrghomes.com` needs a record in `lrghomes.com`'s Google Cloud DNS (no API access + Ryan didn't want to touch it); a dedicated domain via Vercel (where DNS would be CLI-managed) was offered — Ryan chose to keep the GitHub URL for now. Email is Gmail (good to ~2k/day); graduate to **Resend** if scaling (key already created; `send.lrghomes.com` registered, just needs DNS verification).

## 🔧 Ops scripts (`scripts/`, run from repo root)
- `node scripts/backup-csv.mjs` — dump all Supabase data → `backups/` CSVs (gitignored)
- `node scripts/test-isolation.mjs` — RLS per-user isolation test (real user JWTs)
- `node scripts/test-ui.mjs` — headless OTP UI + new-user-starts-empty test
- `node scripts/set-otp-email.mjs` — (re)apply the 6-digit OTP email template
- `node scripts/sb.mjs "<sql>"` — ad-hoc query via Supabase Management API (PAT in `.env.local`)

---

## What Was Built

Unified Physiq app merging macro-tracker and weight-tracker into a single PWA.

### Features
- **🥗 Macros tab** — Today's progress cards (cal/protein/carbs/fat), meal chart, today's log, calorie history with range tabs (7D/14D/30D/3M/All), daily 7-day breakdown, averages table
- **⚖️ Weight tab** — Current/7-day avg/rate/goal stats, weekly trend (this/last week), full chart with 7-day + 30-day moving averages + goal line (7D through All), weight log history, CSV export
- **➕ Log tab** — AI text meal logging (Gemini 2.5 Flash), photo logging (nutrition labels + food photos), quick-add favorites (6 presets), manual macro entry, weight shortcut, settings (macro goals + Gemini key)

### Data
- Macro seed: Mar 1–7, 2026 (22 entries)
- Weight seed: Jul 2025–Mar 2026 (180+ entries, Ryan's real data)
- localStorage-based (no backend required)
- Auto-syncs macro data from macro-tracker/data.json (Telegram bot integration)

### Tech
- Single `index.html` (~1800 lines), all inline
- Chart.js 4.4.0
- PWA: manifest.json + sw.js (network-only)
- GitHub Pages hosted

---

## Next Steps (from PROJECT.md roadmap)
- [ ] New Physiq Telegram bot token
- [ ] Point macro-bot to physiq/data.json
- [ ] Rebrand/deprecate old macro-tracker and weight-tracker repos
- [ ] Supabase backend for user accounts
