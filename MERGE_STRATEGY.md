# Physiq Merge Strategy
**Date:** March 15, 2026  
**Task:** Consolidate macro-tracker and weight-tracker into unified Physiq dashboard

## Current State Analysis

### Macro Tracker
- **Structure:** Single-page PWA (index.html only)
- **Data:** `data.json` - array of meal entries `{date, time, description, calories, protein, carbs, fat}`
- **Features:** Today view (progress bars), History view (7-day cards), calorie chart
- **Styling:** Dark theme with green accent (#43e97b), bottom nav
- **Backend:** None (GitHub Pages sync)
- **Size:** 53KB HTML

### Weight Tracker
- **Structure:** Single-page PWA + Node.js server (server.js)
- **Data:** `data.json` - array of weight entries `{date, weight}`
- **Features:** Multi-timeframe tabs (7D/14D/30D/3M/6M/1Y/All), chart, moving averages
- **Styling:** Dark theme, same color scheme as macro-tracker
- **Backend:** Server for POSTs to data.json
- **Size:** 32KB HTML

## Merge Strategy

### 1. **Architecture Decision**
- **Single unified `index.html`** with tab-based navigation
- **Single `data.json`** combining both datasets: `{macros: [], weights: []}`
- **Unified `server.js`** handling both data types
- **Single manifest.json** for "Physiq" branding
- **New directory:** `/physiq/` as the source of truth

### 2. **Data Schema**
```json
{
  "macros": [
    {
      "date": "2026-03-08",
      "time": "12:12 PM",
      "description": "...",
      "calories": 370,
      "protein": 27,
      "carbs": 45,
      "fat": 3
    }
  ],
  "weights": [
    {
      "date": "2026-03-13",
      "weight": 190.0
    }
  ]
}
```

### 3. **UI/UX Layout**
```
┌─────────────────────────┐
│  Physiq                 │  ← Header + logo
├─────────────────────────┤
│ [Today] [History] [W]   │  ← Tab buttons
├─────────────────────────┤
│                         │
│  Today View (default)   │
│  - Macro progress bars  │
│  - Weight snapshot      │
│                         │
├─────────────────────────┤
│ ⚡ Physiq | 📊 | ⚙️    │  ← Bottom nav
└─────────────────────────┘
```

**Tabs:**
- **Physiq** (dashboard): Today's macros + recent weight
- **History**: Macro history (left) + Weight chart (right) in columns
- **Settings**: Target macros, units, theme

### 4. **Implementation Steps**
1. ✅ Create `/physiq/index.html` - unified UI
2. ✅ Migrate macro-tracker styles + logic
3. ✅ Migrate weight-tracker styles + logic
4. ✅ Create unified `data.json` structure
5. ✅ Create unified `server.js`
6. ✅ Update manifest.json for Physiq branding
7. ✅ Test data sync and UI transitions
8. ✅ Export to GitHub as `physiq` repo

### 5. **Decommissioning**
- Keep macro-tracker & weight-tracker as read-only archive repos
- Redirect GitHub Pages to physiq
- Update macro-bot to target physiq data.json

## Blockers
- None identified yet. Both apps use simple JSON + vanilla JS.

## Success Criteria
- ✅ Single app with both data types visible
- ✅ Tabs working for Today/History/Settings
- ✅ Charts render (macro + weight)
- ✅ Data persists on server
- ✅ Mobile PWA works
