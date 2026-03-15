#!/usr/bin/env bash
# sync-weights.sh — Sync Physiq weight entries to Google Sheets backup
# Runs after each new weight log or via daily cron
# Sheet: Weight Tracker Backup (1xYzYyxevNq0b1j9CHBJMhPIRwxbf06JghSBY4q2ET0U)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_FILE="$SCRIPT_DIR/data.json"
SHEET_ID="1xYzYyxevNq0b1j9CHBJMhPIRwxbf06JghSBY4q2ET0U"
GOG_ACCOUNT="info@lrghomes.com"
LOG_FILE="$SCRIPT_DIR/sync-weights.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting weight sync..."

# Step 1: Get existing dates from Google Sheets (column A, skip header)
SHEETS_JSON=$(GOG_ACCOUNT="$GOG_ACCOUNT" gog sheets get "$SHEET_ID" "Sheet1!A2:B10000" --json 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$SHEETS_JSON" ]; then
  log "ERROR: Failed to fetch sheets data"
  exit 1
fi

# Step 2: Extract existing dates into a temp file
EXISTING_DATES=$(echo "$SHEETS_JSON" | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const data = JSON.parse(chunks.join(''));
  const dates = (data.values || []).map(row => row[0]).filter(Boolean);
  console.log(JSON.stringify(dates));
});
")

# Step 3: Get Physiq weights and find new entries not in Sheets
NEW_ROWS=$(node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$DATA_FILE', 'utf8'));
const existingDates = new Set($EXISTING_DATES);
const newEntries = (data.weights || []).filter(e => !existingDates.has(e.date));
if (newEntries.length === 0) {
  console.log('[]');
} else {
  // Format as array of [date, weight] rows for Sheets append
  const rows = newEntries
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => [e.date, String(e.weight)]);
  console.log(JSON.stringify(rows));
}
")

# Step 4: Append new rows if any
if [ "$NEW_ROWS" = "[]" ]; then
  log "No new weight entries to sync."
  exit 0
fi

COUNT=$(echo "$NEW_ROWS" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).length);")
log "Appending $COUNT new weight entries to Sheets..."

GOG_ACCOUNT="$GOG_ACCOUNT" gog sheets append "$SHEET_ID" "Sheet1!A:B" \
  --values-json "$NEW_ROWS" \
  --insert INSERT_ROWS 2>/dev/null

if [ $? -eq 0 ]; then
  log "✅ Successfully synced $COUNT entries to Google Sheets."
else
  log "ERROR: Failed to append rows to Sheets."
  exit 1
fi
