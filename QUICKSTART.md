# Physiq Quickstart

## Local Server (Development)

```bash
cd /Users/ryanlarocca/.openclaw/workspace/physiq
node server.js
```

Then open: **http://127.0.0.1:8888**

Server listens on port 8888 by default. To use a different port:
```bash
PORT=3000 node server.js
```

---

## What You'll See

### Dashboard Tab (Default)
- **Progress bars** for Calories, Protein, Carbs, Fat
- **Current weight** with trend
- **7-day calorie chart**

### History Tab
- **Last 7 days** of macro summaries (left side)
- **Last 5 weight entries** with trends (right side)
- **30-day weight trend chart**

### Settings Tab
- **Customize targets:** Calories, Protein, Carbs, Fat
- **Save Settings** button
- **Clear All Data** (with confirmation)
- **Last sync time**

---

## Features

### 📊 Dashboard
- Real-time progress bars with color coding:
  - 🟢 Green: On track (<90%)
  - 🟡 Yellow: Warning (90-100%)
  - 🔴 Red: Over target (>100%)
- Weight snapshot with trend indicator
- Interactive charts (7-day calories, 30-day weight)

### 💾 Data Persistence
- **Auto-saves** to server via POST /data.json
- **Falls back** to localStorage if server unavailable
- **Sync button** (🔄) manually refreshes

### 📱 Mobile PWA
- Add to home screen (iOS/Android)
- Works offline with service worker
- Touch-optimized interface
- Safe-area insets for notches/home bar

### ⚙️ Customizable
- **Set own targets** for macros
- **Settings persist** across sessions
- **Clear data** without losing app

---

## API

### GET /data.json
Returns current state:
```json
{
  "macros": [...],
  "weights": [...],
  "settings": { "calorieTarget": 2500, ... }
}
```

### POST /data.json
Save updated data:
```bash
curl -X POST http://127.0.0.1:8888/data.json \
  -H "Content-Type: application/json" \
  -d '{"macros": [...], "weights": [...], "settings": {...}}'
```

---

## Connecting to Telegram Bot

Update your macro-bot to push to Physiq:

```javascript
// In macro-bot (before: macro-tracker)
const REPO = 'physiq';
const FILE = 'data.json';
const API_URL = 'https://api.github.com/repos/ryanlarocca/physiq/contents/data.json';

// Push data after each macro log
await pushToGitHub(newData);
```

---

## Troubleshooting

### Server won't start
```bash
# Check if port is in use
lsof -i :8888
# Kill process and try again
kill -9 <PID>
```

### Data not persisting
- Check if server is running (should see "Physiq server running...")
- Try clicking 🔄 sync button
- Check browser console for errors (F12)
- Falls back to localStorage automatically

### Charts not rendering
- Ensure Chart.js loads (check Network tab in DevTools)
- Try refreshing page
- Clear browser cache

### PWA not installing
- Use HTTPS (GitHub Pages) or localhost for PWA
- Check manifest.json is loading (Network tab)
- Try "Add to Home Screen" from browser menu

---

## File Structure

```
physiq/
├── index.html          # Main app (all JS inline)
├── server.js           # Backend (Node.js)
├── data.json           # Data storage
├── manifest.json       # PWA config
├── sw.js               # Service worker
├── icon-192.png        # App icon
├── icon-512.png        # Splash icon
└── docs/
    ├── PROJECT.md      # Vision & roadmap
    ├── MERGE_STRATEGY.md
    ├── IMPLEMENTATION.md
    └── QUICKSTART.md   # This file
```

---

## Common Tasks

### Add a new macro entry
1. Go to **Dashboard** tab
2. Tap to log (future version with quick-add)
3. Or use Telegram bot `/log` command

### Update weight
1. Go to **Dashboard** or **History**
2. Tap to add (future version)
3. Or use Telegram bot

### Change daily targets
1. Go to **Settings** tab
2. Update Calorie/Protein/Carbs/Fat targets
3. Click **Save Settings**

### Export data
1. Go to Settings
2. Browser DevTools → Application → LocalStorage
3. Copy `physiqData` value (or GET /data.json on server)

### Reset app
1. Go to **Settings** tab
2. Click **Clear All Data**
3. Confirm the warning

---

## Development

### Run tests
```bash
# Validate JSON
node -e "require('./data.json')"

# Check server starts
timeout 5 node server.js || true
```

### Build for deployment
```bash
# Copy to GitHub
git add -A
git commit -m "Physiq merge implementation complete"
git push origin main
```

### Enable GitHub Pages
1. Go to GitHub repo settings
2. Pages → Source → main branch / physiq folder
3. Custom domain (optional)
4. Visit https://ryanlarocca.github.io/physiq/

---

**Questions?** Check IMPLEMENTATION.md or MERGE_STRATEGY.md for technical details.
