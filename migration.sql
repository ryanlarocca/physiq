-- Physiq Supabase Migration
-- Run this ONCE in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/msmlqdrfsieixudgsced/sql/new

-- Weight entries table
CREATE TABLE IF NOT EXISTS weight_entries (
  id bigserial PRIMARY KEY,
  date text NOT NULL,
  weight float NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Macro entries table
CREATE TABLE IF NOT EXISTS macro_entries (
  id bigserial PRIMARY KEY,
  date text NOT NULL,
  calories float NOT NULL DEFAULT 0,
  protein float NOT NULL DEFAULT 0,
  carbs float NOT NULL DEFAULT 0,
  fat float NOT NULL DEFAULT 0,
  food_name text NOT NULL DEFAULT '',
  time_logged text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (required for anon key access)
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE macro_entries ENABLE ROW LEVEL SECURITY;

-- Allow anon users to do everything (no sign-in required)
CREATE POLICY "allow_all_weight" ON weight_entries FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_macros" ON macro_entries FOR ALL TO anon USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_weight_date ON weight_entries(date);
CREATE INDEX IF NOT EXISTS idx_macro_date ON macro_entries(date);
