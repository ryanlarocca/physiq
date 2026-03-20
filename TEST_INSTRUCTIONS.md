# Physiq Session Persistence — Test Instructions

## What Was Fixed
✅ **Session now persists across:**
- Browser restart
- Page refresh
- App close/reopen (mobile PWA)
- Long idle periods (auto-token refresh)
- Tab visibility changes (resume from background)

## Quick Test (5 minutes)

### Test 1: Browser Restart (Simplest)
```
1. Open Physiq app in browser
2. Enter email & password, sign in
3. Close browser COMPLETELY (cmd+Q on Mac, not just tab close)
4. Wait 10 seconds
5. Reopen browser
6. Go to Physiq URL
7. ✅ SHOULD BE LOGGED IN (no login screen)
```

### Test 2: Page Refresh
```
1. Log in if not already
2. Press F5 or Cmd+R
3. ✅ SHOULD STAY LOGGED IN
4. Data should load immediately
```

### Test 3: Tab Background (Mobile/Desktop)
```
1. Log in
2. Switch to another tab/app for 2-3 minutes
3. Come back to Physiq tab
4. ✅ SHOULD STILL BE LOGGED IN
```

## Debug Console Commands
Open DevTools (F12) → Console tab and run:

### Check if session is stored:
```javascript
localStorage.getItem('sb-physiq-session')
// Should return a long JSON string with auth tokens
```

### Check session user:
```javascript
const { data: { session } } = await db.auth.getSession()
console.log(session?.user?.email)
// Should print user email
```

### Check session expiry:
```javascript
const { data: { session } } = await db.auth.getSession()
console.log(new Date(session.expires_at * 1000))
// Should print future date
```

### Force session check:
```javascript
await ensureSessionAlive()
console.log('Session check complete, check console above')
```

### Watch auth logs:
```
Filter console messages by: [auth], [auth-persist], [auth-keep-alive]
```

## Expected Console Logs (on app load)

```
[auth-persist] getItem('sb-physiq-session') = found              // ✅ Session restored
[auth] Checking for existing session...
[auth] Session found in storage for: user@example.com           // ✅ Auto-login
[auth] State changed: event='INITIAL_SESSION', user=FOUND
[supabase] Loaded 10 weights + 5 macros for user xyz...         // ✅ Data loaded
```

## Troubleshooting

### Problem: Still seeing login screen after restart
**Check:**
- [ ] `localStorage.getItem('sb-physiq-session')` returns null?
  - Try clearing browser cache and logging in again
- [ ] Is Supabase token expired?
  - Check: `new Date(session.expires_at * 1000) > new Date()` should be true
- [ ] Does console show errors?
  - Screenshot errors and share with dev

### Problem: Getting logged out randomly
**Check:**
- [ ] Is `autoRefreshToken: true` in Supabase client config?
- [ ] Check console for `[auth-keep-alive]` logs
- [ ] Try waiting 5+ minutes to see if keep-alive refreshes

### Problem: PWA mode not persisting
**Check:**
- [ ] Is localStorage enabled in PWA settings?
  - iOS Safari: Settings → Privacy → unblock cookies for site
  - Android Chrome: Settings → Privacy → allow local data
- [ ] Try logging in again in PWA mode
- [ ] Close and reopen app from home screen

## Success Indicators
🟢 When working correctly, you'll see:
- ✅ Login → Browser restart → Still logged in (no spinner/loading)
- ✅ Console: `[auth] Session found in storage for: ...`
- ✅ No re-login prompts after browser close
- ✅ Data loads instantly on second visit

## Questions?
Check the full fix details: `SESSION_FIX_SUMMARY.md`
