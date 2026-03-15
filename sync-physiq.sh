#!/usr/bin/env bash
# sync-physiq.sh — Unified sync for Physiq macros + weights to Google Sheets
# Syncs after each data save (triggered by server.js) or via daily cron
#
# Sheets:
#   Macros → "Macro Tracker"     (1OhN4msHpOWbL9Fl9m8X4EyPPXEApInjcnPZxD_BE8WQ, Sheet1)
#   Weights → "Weight Tracker Backup" (1xYzYyxevNq0b1j9CHBJMhPIRwxbf06JghSBY4q2ET0U, Sheet1)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_FILE="$SCRIPT_DIR/data.json"
MACRO_SHEET_ID="1OhN4msHpOWbL9Fl9m8X4EyPPXEApInjcnPZxD_BE8WQ"
WEIGHT_SHEET_ID="1xYzYyxevNq0b1j9CHBJMhPIRwxbf06JghSBY4q2ET0U"
GOG_ACCOUNT="info@lrghomes.com"
LOG_FILE="$SCRIPT_DIR/sync-physiq.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

sync_macros() {
  log "--- Syncing macros..."

  # Get existing macro entries from sheet (date+time+description as dedup key)
  local SHEETS_JSON
  SHEETS_JSON=$(GOG_ACCOUNT="$GOG_ACCOUNT" gog sheets get "$MACRO_SHEET_ID" "Sheet1!A2:G10000" --json 2>/dev/null) || {
    log "ERROR: Failed to fetch macro sheet data"
    return 1
  }

  # Find new entries not already in sheet
  local NEW_ROWS
  NEW_ROWS=$(node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$DATA_FILE', 'utf8'));
const raw = JSON.parse(process.argv[1]);
// Handle both array and {values:[...]} response formats
const sheetRows = Array.isArray(raw) ? raw : (raw.values || []);

// Normalize time: remove leading zero from hour ('03:01 PM' -> '3:01 PM')
const normTime = t => {
  if (!t) return '';
  const parts = t.split(':');
  parts[0] = String(parseInt(parts[0], 10));
  return parts.join(':');
};

// Build set of existing (date, normalizedTime, description) keys
const existing = new Set();
for (const row of sheetRows) {
  if (row.length >= 3) {
    existing.add(row[0] + '|' + normTime(row[1]) + '|' + row[2]);
  }
}

// Find macros not in sheet
const macros = (data.macros || []).sort((a, b) =>
  (a.date + (a.time||'')).localeCompare(b.date + (b.time||''))
);

const newRows = macros.filter(m => {
  const key = m.date + '|' + normTime(m.time || '') + '|' + (m.description || '');
  return !existing.has(key);
}).map(m => [
  m.date,
  normTime(m.time || ''),
  m.description || '',
  String(m.calories || ''),
  String(m.protein || ''),
  String(m.carbs || ''),
  String(m.fat || '')
]);

console.log(JSON.stringify(newRows));
" "$SHEETS_JSON")

  if [ "$NEW_ROWS" = "[]" ]; then
    log "Macros: no new entries to sync."
    return 0
  fi

  local COUNT
  COUNT=$(echo "$NEW_ROWS" | node -e "
const d = require('fs').readFileSync('/dev/stdin','utf8');
console.log(JSON.parse(d).length);
")

  log "Macros: appending $COUNT new entries..."
  GOG_ACCOUNT="$GOG_ACCOUNT" gog sheets append "$MACRO_SHEET_ID" "Sheet1!A:G" \
    --values-json "$NEW_ROWS" \
    --insert INSERT_ROWS 2>/dev/null

  log "✅ Macros: synced $COUNT entries."
}

sync_weights() {
  log "--- Syncing weights..."

  # Get existing weight dates from sheet
  local SHEETS_JSON
  SHEETS_JSON=$(GOG_ACCOUNT="$GOG_ACCOUNT" gog sheets get "$WEIGHT_SHEET_ID" "Sheet1!A2:B10000" --json 2>/dev/null) || {
    log "ERROR: Failed to fetch weight sheet data"
    return 1
  }

  # Find new weight entries
  local NEW_ROWS
  NEW_ROWS=$(node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$DATA_FILE', 'utf8'));
const raw = JSON.parse(process.argv[1]);
// Handle both array and {values:[...]} response formats
const sheetRows = Array.isArray(raw) ? raw : (raw.values || []);

// Build set of existing dates
const existing = new Set(sheetRows.map(r => r[0]).filter(Boolean));

const newRows = (data.weights || [])
  .filter(e => !existing.has(e.date))
  .sort((a, b) => a.date.localeCompare(b.date))
  .map(e => [e.date, String(e.weight)]);

console.log(JSON.stringify(newRows));
" "$SHEETS_JSON")

  if [ "$NEW_ROWS" = "[]" ]; then
    log "Weights: no new entries to sync."
    return 0
  fi

  local COUNT
  COUNT=$(echo "$NEW_ROWS" | node -e "
const d = require('fs').readFileSync('/dev/stdin','utf8');
console.log(JSON.parse(d).length);
")

  log "Weights: appending $COUNT new entries..."
  GOG_ACCOUNT="$GOG_ACCOUNT" gog sheets append "$WEIGHT_SHEET_ID" "Sheet1!A:B" \
    --values-json "$NEW_ROWS" \
    --insert INSERT_ROWS 2>/dev/null

  log "✅ Weights: synced $COUNT entries."
}

log "====== Physiq sync started ======"
sync_macros
sync_weights
log "====== Physiq sync complete ======"
