-- Clear all analytics events from the table
-- Run this in Supabase SQL Editor to reset analytics data

DELETE FROM analytics_events;

-- Optional: Reset sequence if you want IDs to start from 1 again
-- ALTER SEQUENCE analytics_events_id_seq RESTART WITH 1;
