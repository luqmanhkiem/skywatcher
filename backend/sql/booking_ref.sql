-- Add booking reference to bags
-- Run once in the Supabase SQL editor.

ALTER TABLE bags ADD COLUMN IF NOT EXISTS booking_ref VARCHAR(6);
CREATE INDEX IF NOT EXISTS idx_bags_booking_ref ON bags (booking_ref);
