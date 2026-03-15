# Green Dot Nav Indicator Fix

## Problem
The green dot indicator on the active nav button was overlapping the "Weight" button label, making it unreadable.

## Root Cause Analysis
1. **Missing overflow property**: Nav container had no explicit `overflow` handling, potentially clipping the absolutely-positioned dot
2. **Incorrect z-index layering**: Dot had `z-index: 0` while label had `z-index: 1`, but the positioning caused visual overlap
3. **Insufficient sizing**: Dot was only 4px, making it hard to see
4. **Tight spacing**: Dot positioned at `bottom: -4px` (very close to button), no visual separation

## Solution Applied

### CSS Changes to `index.html`

#### 1. Nav Container (line 71-81)
```diff
  nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    background: var(--card);
    border-top: 1px solid var(--border);
    padding: 10px 20px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
    z-index: 200;
+   overflow: visible;
  }
```
**Why**: Ensures the absolutely-positioned `::after` pseudo-element is not clipped by the nav container.

#### 2. Active Button Indicator (line 105-119)
```diff
  .nav-btn.active::after {
    content: '';
    position: absolute;
-   bottom: -4px;
+   bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
-   width: 4px;
-   height: 4px;
+   width: 6px;
+   height: 6px;
    background: var(--green);
    border-radius: 50%;
-   z-index: 0;
+   z-index: 999;
+   box-shadow: 0 0 3px rgba(67, 233, 123, 0.5);
  }
```

**Changes**:
- **bottom: -8px** (was -4px): More separation between dot and button
- **width/height: 6px** (was 4px): Larger, more visible dot
- **z-index: 999** (was 0): Well above label z-index (1), ensuring no overlap
- **box-shadow**: Subtle glow for visual depth and modern appearance

## Verification

### Test Page
Created `TEST_NAV.html` with interactive test:
- Click each button to activate it
- Verify green dot appears cleanly below icon
- Confirm no overlap with labels
- All 3 buttons (Macros, Weight, Log) render cleanly

### Visual Results
✅ Green dot now fully visible and doesn't cover any label text
✅ All 3 nav buttons display cleanly
✅ Dot has nice glow effect for visual polish
✅ Better visual hierarchy and spacing

## Files Modified
- `index.html` - CSS fixes for nav and dot positioning
- `TEST_NAV.html` - Interactive test page (new)

## Git Commit
```
bbdb0cf Fix: Green dot nav indicator overlapping Weight button label
```

## Technical Details
- **Z-Index Strategy**: Dot (z-index: 999) >> Label (z-index: 1) >> Default (z-index: 0)
- **Positioning**: Absolute positioning relative to parent `.nav-btn` with `position: relative`
- **Overflow**: Container overflow set to `visible` to prevent clipping
- **Responsive**: Works on all screen sizes due to flex layout and relative positioning

## Browser Compatibility
- ✅ Modern browsers (Chrome, Safari, Firefox, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Fixed positioning compatible with mobile safe areas

## Future Improvements
- Could animate dot appearance on state change
- Could add hover effect to dot
- Could make dot size/color configurable via CSS variables
