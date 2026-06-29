# Physiq – Status

**Last Updated:** June 29, 2026  
**Status:** ✅ LIVE at https://ryanlarocca.github.io/physiq/  
**Changelog:** [CHANGELOG.md](./CHANGELOG.md)

## 📍 Where we left off
- **Now —** Multi-user launch ready. Login is **passwordless email OTP** (6-digit code, no link) — fixes the "got the email but couldn't log in" bug. Each user gets **isolated data** (Supabase RLS by `user_id`); removed the `seedFromDataJson` bug that injected Ryan's data into every new account. AI food logging moved off the dead OpenRouter key onto the **Anthropic API directly** (Claude Sonnet 4.6, text + photo), and the `physiq-api` proxy is now **JWT-gated** (only signed-in users can spend AI). The in-app Gemini-key field is gone (keys are server-side).
- **Next —** Ryan's phone smoke test (real OTP email, photo macros, PWA v6); re-engage the 3 stuck unconfirmed users (they auto-recover by requesting a code).
- **Blockers / open —** Fix the broken `com.physiq.weight-sync` launchd job (points at a missing `sync-weights.sh`). Optionally retire the unused OpenRouter key + `gemini.js`.

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
