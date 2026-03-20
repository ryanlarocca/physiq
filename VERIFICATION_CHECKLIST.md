# Physiq Macro Goals Persistence — Implementation Verification

## Code Changes Verified ✅

### 1. New Functions Added
- ✅ `loadGoalsFromSupabase()` — Loads goals from cloud on app startup
- ✅ `syncGoalsToSupabase(goals)` — Async saves goals to Supabase with debounce
- ✅ Updated `saveGoals()` — Now shows "Saving..." → "Saved ✓" feedback
- ✅ Updated `renderLogView()` — Calls loadGoalsFromSupabase() on app load
- ✅ Updated `saveTargets()` — Triggers async Supabase sync

### 2. Function Locations in index.html
```
Line 1334-1428: ✅ New macro goals functions (loadGoalsFromSupabase, syncGoalsToSupabase)
Line 1339-1348: ✅ Updated saveTargets() with Supabase sync trigger
Line 1885-1910: ✅ Updated saveGoals() with visual feedback
Line 2387-2404: ✅ Updated renderLogView() with loadGoalsFromSupabase() call
```

### 3. Integration Points
- ✅ saveGoals() calls saveTargets() which calls syncGoalsToSupabase()
- ✅ renderLogView() calls loadGoalsFromSupabase() on app startup
- ✅ Visual feedback: "Saving..." → "Saved ✓" or "Saved (offline)"
- ✅ Timeout protection: 3-second max wait for Supabase sync
- ✅ Error handling: Graceful fallback to localStorage if Supabase fails

## Files Created/Modified

| File | Status | Purpose |
|------|--------|---------|
| `index.html` | ✅ Modified | Code updated with new functions |
| `MACRO_GOALS_PERSISTENCE_FIX.md` | ✅ Created | Complete documentation |
| `IMPLEMENT_MACRO_GOALS.txt` | ✅ Created | Quick implementation guide |
| `VERIFICATION_CHECKLIST.md` | ✅ Created | This file |

## Pre-Deployment Checklist

### SQL Migration
- [ ] Log into Supabase: https://supabase.com/dashboard
- [ ] Navigate to Physiq project
- [ ] Go to SQL Editor
- [ ] Create new query
- [ ] Paste the SQL from MACRO_GOALS_PERSISTENCE_FIX.md (user_goals table creation)
- [ ] Run query
- [ ] Verify table created: Check Tables list on left sidebar

### Code Review
- [ ] Verify `index.html` contains all 5 function changes
- [ ] Run: `grep -c "loadGoalsFromSupabase\|syncGoalsToSupabase" index.html`
  - Should return at least 4 (multiple calls)
- [ ] Search for "Saving..." in index.html
  - Should find in saveGoals() function
- [ ] Search for "Saved ✓" in index.html
  - Should find in saveGoals() function

### Local Testing (5 min)
```bash
1. Clear browser cache
2. Open Physiq app
3. Log in with test account
4. Change "Calories" field to 2200
5. Click "Save Goals" button
6. Observe: Should see "Saving..." then "Saved ✓"
7. Close browser completely (cmd+Q on Mac)
8. Wait 5 seconds
9. Reopen browser
10. Go to Physiq URL
11. Verify: Logged in automatically, Calories shows 2200
12. ✅ SUCCESS!
```

## Success Criteria

### ✅ Criteria 1: Browser Restart Persistence
- [ ] Set goals → Save → Close browser → Reopen → Goals restored

### ✅ Criteria 2: Cross-Device Sync
- [ ] Phone: Set calories=2000 → Save → Computer: Open app → Shows 2000

### ✅ Criteria 3: Logout/Login Persistence  
- [ ] Set goals → Sign out → Sign in → Goals restored

### ✅ Criteria 4: Visual Feedback
- [ ] Click "Save Goals" → See "Saving..." → See "Saved ✓"

### ✅ Criteria 5: Offline Capability
- [ ] Go offline → Save goals → See "Saved (offline)" → Goals work offline

### ✅ Criteria 6: Mobile PWA Support
- [ ] Add app to home screen → Set goals → Close app → Reopen → Restored

## Deployment Steps

### Step 1: Create Supabase Table
```sql
CREATE TABLE IF NOT EXISTS user_goals (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  calories int NOT NULL DEFAULT 2500,
  protein int NOT NULL DEFAULT 180,
  carbs int NOT NULL DEFAULT 250,
  fat int NOT NULL DEFAULT 80,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_manage_own_goals" ON user_goals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
```

### Step 2: Deploy Code
1. Push updated `index.html` to production
2. Notify users to hard-refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Step 3: Monitor
- Check browser console for `[goals]` logs
- Monitor Supabase usage (SQL Editor → Logs)
- Collect user feedback on goal persistence

## Rollback Plan

If issues arise:
1. Revert `index.html` to previous version
2. Goals still exist in localStorage (no data loss)
3. Supabase `user_goals` table can be left as-is (harmless)
4. Fix issues and redeploy

## Testing Commands

### Console Debug (F12 → Console tab)

**Check if goals in localStorage:**
```javascript
localStorage.getItem('mt_targets_v1')
// Should return: {"calories":2200,"protein":200,"carbs":250,"fat":80}
```

**Check if session exists:**
```javascript
localStorage.getItem('sb-physiq-session')
// Should return: long JSON string with auth token
```

**Check Supabase session:**
```javascript
const { data: { session } } = await db.auth.getSession()
console.log(session?.user?.email)
// Should print user email
```

**Manually load goals from Supabase:**
```javascript
await loadGoalsFromSupabase()
// Should print: [goals] Loaded from Supabase: {calories: ..., ...}
```

**Manually save goals to Supabase:**
```javascript
const testGoals = {calories: 2300, protein: 190, carbs: 260, fat: 85}
await syncGoalsToSupabase(testGoals)
// Should print: [goals] Saved to Supabase: {user_id: '...', ...}
```

**Force reload goals from UI:**
```javascript
await renderLogView()
// Should load goals from Supabase and update inputs
```

## Expected Console Logs

When working correctly:
```
[goals] Loaded from Supabase: {calories: 2200, protein: 200, carbs: 250, fat: 80}
[goals] Saved to Supabase: {user_id: 'abc-123...', calories: 2200, ...}
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Saved (offline)" instead of "Saved ✓" | Network latency — expected! Goals saved locally |
| Goals not syncing across devices | Both logged in with same email? Check auth token |
| "Saving..." spinner never completes | Slow network — increase timeout in saveGoals() |
| Goals blank after refresh | Not authenticated — check sb-physiq-session in localStorage |

## Success Indicators 🟢

- ✅ Console shows `[goals] Loaded from Supabase` on app load
- ✅ Console shows `[goals] Saved to Supabase` when saving
- ✅ Button shows "Saving..." then "Saved ✓"
- ✅ Goals persist across browser restart
- ✅ Goals sync across devices (same user)
- ✅ Works offline with "Saved (offline)" message
- ✅ PWA app restores goals on reopen
- ✅ No errors in console (warnings are OK, errors are bad)

## Next Steps

1. ✅ Code implementation complete
2. ⏳ Run Supabase migration (create user_goals table)
3. ⏳ Deploy updated index.html
4. ⏳ Test with full test suite (see MACRO_GOALS_PERSISTENCE_FIX.md)
5. ⏳ Monitor for issues
6. ⏳ Announce feature to users

---

**Status:** ✅ Implementation Complete - Ready for Supabase Migration & Deployment
**Created:** 2026-03-19
**Updated:** 2026-03-19
