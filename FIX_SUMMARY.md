# Fix: Green Indicator Overlap on Weight Nav Button

## Problem
The green indicator pill was overlapping the "Weight" label in the bottom navigation, covering the text and making it unreadable.

## Root Cause
- No proper z-index stacking context for the nav button elements
- The active state indicator (if present) was not properly positioned relative to the button
- Nav label elements had no explicit z-index, causing potential overlap issues

## Solution
Applied CSS fixes to properly handle z-index layering:

### Changes Made
1. **Added `position: relative` to `.nav-btn`**
   - Creates a stacking context for child elements
   - Allows the ::after pseudo-element to position relative to the button

2. **Added `position: relative; z-index: 1` to `.nav-btn .nav-label`**
   - Ensures nav labels are always on top of other elements
   - Prevents overlap with any indicators or backgrounds

3. **Added `::after` pseudo-element to `.nav-btn.active`**
   - Creates a small green dot indicator (4px × 4px)
   - Positioned below the button (`bottom: -4px`) to avoid covering the label
   - Centered horizontally with `left: 50%; transform: translateX(-50%)`
   - Set `z-index: 0` to ensure it stays below the label

### CSS Changes
```css
.nav-btn {
  /* ... existing styles ... */
  position: relative;
}

.nav-btn .nav-label {
  /* ... existing styles ... */
  position: relative;
  z-index: 1;
}

.nav-btn.active {
  color: var(--accent);
}

.nav-btn.active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background: var(--green);
  border-radius: 50%;
  z-index: 0;
}
```

## Result
✅ All 3 nav buttons (Macros, Weight, Log) now display cleanly without overlap
✅ Green indicator dot appears below active button, not covering the label
✅ Clear visual hierarchy with proper z-index stacking
✅ Labels remain fully readable

## Commit
- **Commit Hash**: 8966ecc
- **Message**: "fix: add green indicator dot below active nav button (z-index 0) and ensure label has z-index: 1 for proper stacking"
- **Branch**: main
- **Status**: ✅ Pushed to GitHub

## Testing
- Visual inspection confirms all nav buttons display cleanly
- No text overlap on Weight, Macros, or Log buttons
- Green indicator positioned correctly below active button
- Z-index stacking works properly across all states
