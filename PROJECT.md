# Physiq — Project State & Handoff
Last updated: March 8, 2026

## What Is Physiq
AI-powered fitness co-pilot. Chat to log macros, weight, workouts. Photo a nutrition label — it reads it. Full body composition tracking including DEXA scans. One app, everything connected.

## Current Stack
- **Macro Tracker Web App**: https://ryanlarocca.github.io/macro-tracker/
  - Local: /Users/ryanlarocca/.openclaw/workspace/macro-tracker/
  - GitHub: https://github.com/ryanlarocca/macro-tracker
  - PWA (add to home screen), dark theme, bottom nav
  - Today view: macro progress bars + remaining
  - History view: last 7 days cards + calorie chart
  - Syncs from data.json in repo on load

- **Weight Tracker Web App**: https://ryanlarocca.github.io/weight-tracker/
  - Local: /Users/ryanlarocca/.openclaw/workspace/weight-tracker/
  - GitHub: https://github.com/ryanlarocca/weight-tracker
  - PWA, seeded with full historical data (Jul 2025 - Mar 2026)
  - 7D/14D/30D/3M/6M/1Y/All tabs, 7-day + 30-day moving averages

- **Telegram Macro Bot**:
  - Local: /Users/ryanlarocca/.openclaw/workspace/macro-bot/
  - Token: 8665407876:AAFEKbntImZQVxVx8spFDLkdC2Vy_R9tniE (OLD - to be replaced with Physiq bot token)
  - Model: claude-haiku-4-5 (vision + text parsing)
  - After each log: pushes data.json to macro-tracker GitHub repo via API
  - Commands: /today, /log, /targets, /week, /delete, /clear
  - Running as background process: start.sh / stop.sh

## Google Services (info@lrghomes.com)
- **Macro Tracker Sheet**: 1OhN4msHpOWbL9Fl9m8X4EyPPXEApInjcnPZxD_BE8WQ
- **Weight Tracker Sheet**: 1xYzYyxevNq0b1j9CHBJMhPIRwxbf06JghSBY4q2ET0U
- **Vision & Roadmap Doc**: https://docs.google.com/document/d/1yLj5whx95-mWlsKEdyFuv1F-dsxt_9GYckpZGkkLYLQ/edit
- **Drive structure**: Health & Fitness / Macros & Nutrition, Real Estate, Thadius (AI Assistant)

## API Keys & Credentials
- Anthropic API Key: in /Users/ryanlarocca/.openclaw/workspace/macro-bot/.env
- GitHub Token: in macro-bot/.env (for data.json sync)
- GitHub account: ryanlarocca (gh CLI authenticated)

## Real Food Data (Ryan's actual logs)
- Mar 5: 2,367 cal | 223p | 193c | 65f
- Mar 6: 2,521 cal | 193p | 279c | 71f
- Mar 7: 2,964 cal | 239p | 369c | 61f
- Mar 8: In progress (oatmeal entry from bot so far)
- Default targets: 2,500 cal / 180g protein / 250g carbs / 80g fat

## Product Roadmap (Priority Order)
### Immediate (this week)
- [ ] New Telegram bot token under Physiq branding
- [ ] Rebrand web apps as Physiq (name, colors, logo)
- [ ] Landing page at physiq domain
- [ ] Workout logging in bot ("45 min run, 6mph" → logged)
- [ ] DEXA scan tracking section in weight tracker

### Phase 2 (weeks 2-4)
- [ ] Supabase backend — user accounts + cloud sync
- [ ] Stripe billing ($9.99/mo)
- [ ] Multi-user bot (scope data by Telegram user_id)
- [ ] Custom domain

### Phase 3+
- [ ] Apple Health sync
- [ ] AI weekly insights
- [ ] Voice logging
- [ ] Coach dashboard

## Business Model
- Price: $9.99/mo or $79.99/yr
- Free tier: manual web logging, weight tracking
- Pro: Telegram bot, photo scanning, AI insights, unlimited history
- Competitors: MacroFactor ($11.99), Carbon ($14.99), Cronometer ($9.99)

## Revenue Projections
- 500 users → $4,455/mo net (89% margin)
- 5,000 users → $45,100/mo net (90% margin)
- 20,000 users → $167,800/mo net (84% margin)

## Notes
- AI cost per user: ~$0.18-0.50/month (Claude Haiku, fractions of a cent per log)
- One backend handles all users — NOT one VPS per user
- Architecture: Telegram bot → Node.js API → Supabase → Stripe
- Marketing: UGC ads on TikTok/Instagram, micro-influencers $200-500/piece, Reddit organic
