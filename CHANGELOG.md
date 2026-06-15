# Physiq — CHANGELOG

Append-only history of ships for the Physiq weight + macro PWA (https://ryanlarocca.github.io/physiq/). Current-state view lives in [STATUS.md](./STATUS.md).

---

## Ship index (condensed)

### Recent ships (newest first)

- **June 15, 2026** — **Weight chart Y-axis now zooms to actual weights — the goal line was stretching the chart.** Ryan flagged that the weight chart looked too "flat" — current weights cluster ~191–196 but the chart bottom was anchored down at 171 because the **goal weight of 175** was being treated as a data point, pulling `yMin` down and burning ~20 lbs of vertical space on a region with no data. **Root cause:** Chart.js's default auto-scaling considers every dataset (weights, 7-day avg, 30-day avg, and the horizontal goal line) when computing `min`/`max`, then adds its own padding — so a goal point well outside the actual weight cluster anchors the axis to itself. **Fix:** compute `yMin` / `yMax` manually from **visible weights + the 7-day moving average only** (goal explicitly excluded from the bounds calculation), apply a 15% buffer, `Math.floor` / `Math.ceil` to clean integers, and wire those into the y-axis scale config. The goal line still renders on the chart; it just no longer drags the axis around. **Files:** [`index.html`](./index.html) — bounds computation at ~lines 2840–2848, y-axis scale config a few lines below. **Commits:** `dd9cdf7` "Weight chart: dynamic Y-axis scaling to actual data range" + follow-up `0d34c6b` "fix(chart): exclude goal from Y-axis bounds so chart zooms to actual weights" (first pass still included goal in bounds; second pass fixed it). **Verified:** chart on live site now zooms tight to the 191–196 cluster with a small buffer; goal line at 175 still visible; works across 7D / 14D / 30D / All ranges. **Deployed:** GitHub Pages auto-deploy from `main`.
