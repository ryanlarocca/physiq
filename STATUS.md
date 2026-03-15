# Physiq – Status

**Last Updated:** March 15, 2026  
**Status:** ✅ LIVE at https://ryanlarocca.github.io/physiq/

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
