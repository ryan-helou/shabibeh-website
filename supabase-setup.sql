-- ============================================================
-- Shabibeh Analytics Setup for Supabase
-- Run this in your Supabase SQL Editor to create the analytics table
-- ============================================================

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_type TEXT,
  page_path TEXT,
  element TEXT,
  visitor_id TEXT,
  session_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx 
  ON analytics_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx 
  ON analytics_events (event_name);

CREATE INDEX IF NOT EXISTS analytics_events_visitor_id_idx 
  ON analytics_events (visitor_id);

CREATE INDEX IF NOT EXISTS analytics_events_page_path_idx 
  ON analytics_events (page_path);

-- Optional: Add Row Level Security (RLS) if you want to restrict access
-- ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Optional: Create a policy to prevent public access
-- CREATE POLICY "analytics_events_no_public_access" ON analytics_events
--   FOR ALL USING (false);

-- Optional: Allow service role to insert events (required for API)
-- CREATE POLICY "allow_analytics_inserts" ON analytics_events
--   FOR INSERT WITH CHECK (true);

-- Verify the table was created successfully
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM 
  information_schema.columns 
WHERE 
  table_name = 'analytics_events'
ORDER BY 
  ordinal_position;
