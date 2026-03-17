-- ============================================================
-- Paws & Whiskers CRM Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1) Add CRM columns to contest_entries (the ones we don't have yet)
ALTER TABLE contest_entries
  ADD COLUMN IF NOT EXISTS entry_status text DEFAULT 'pending_review' CHECK (entry_status IN ('pending_review','accepted','rejected')),
  ADD COLUMN IF NOT EXISTS is_winner boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS winner_type text DEFAULT 'none' CHECK (winner_type IN ('none','cover','month','special_day')),
  ADD COLUMN IF NOT EXISTS winner_month int CHECK (winner_month IS NULL OR (winner_month >= 1 AND winner_month <= 12)),
  ADD COLUMN IF NOT EXISTS base_price numeric(10,2) DEFAULT 30.00,
  ADD COLUMN IF NOT EXISTS shipping_price numeric(10,2) DEFAULT 6.00,
  ADD COLUMN IF NOT EXISTS total_price numeric(10,2) DEFAULT 36.00,
  ADD COLUMN IF NOT EXISTS call_status text DEFAULT 'not_called' CHECK (call_status IN ('not_called','scheduled','called','follow_up')),
  ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT '';

-- 2) Order items / upsells table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES contest_entries(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('base_entry','featured_month','special_day','postcard_pack','other')),
  description text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS for order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_order_items_entry_id ON order_items(entry_id);

-- 3) Upsell calls log
CREATE TABLE IF NOT EXISTS upsell_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES contest_entries(id) ON DELETE CASCADE,
  call_datetime timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('no_answer','left_voicemail','not_interested','callback','bought_featured_month','bought_special_day','bought_postcard_pack','bought_multiple','other')),
  notes text DEFAULT '',
  created_by text DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

-- RLS for upsell_calls
ALTER TABLE upsell_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for upsell_calls" ON upsell_calls FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_upsell_calls_entry_id ON upsell_calls(entry_id);

-- 4) CRM activity log (general-purpose audit trail)
CREATE TABLE IF NOT EXISTS crm_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES contest_entries(id) ON DELETE CASCADE,
  action text NOT NULL, -- e.g. 'status_change', 'winner_assigned', 'call_logged', 'upsell_added', 'note_added'
  details jsonb DEFAULT '{}',
  created_by text DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for crm_activity_log" ON crm_activity_log FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crm_activity_entry_id ON crm_activity_log(entry_id);

-- 5) Dashboard stats view (replaces old entry_revenue if needed)
CREATE OR REPLACE VIEW crm_dashboard_stats AS
SELECT
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE payment_confirmed = true) AS paid_entries,
  COUNT(*) FILTER (WHERE photo_url IS NOT NULL) AS photos_uploaded,
  COUNT(*) FILTER (WHERE is_winner = true) AS total_winners,
  COUNT(*) FILTER (WHERE call_status != 'not_called') AS calls_made,
  COALESCE(SUM(total_price) FILTER (WHERE payment_confirmed = true), 0) AS total_revenue,
  COALESCE(SUM(base_price + shipping_price) FILTER (WHERE payment_confirmed = true), 0) AS base_revenue,
  COALESCE(SUM(total_price - base_price - shipping_price) FILTER (WHERE payment_confirmed = true AND total_price > base_price + shipping_price), 0) AS upsell_revenue
FROM contest_entries;

-- 6) Entries needing calls view (paid but not yet called)
CREATE OR REPLACE VIEW entries_needing_calls AS
SELECT
  id, full_name, email, phone, pet_name, pet_type,
  created_at, status, call_status, total_price, admin_notes
FROM contest_entries
WHERE payment_confirmed = true
  AND call_status = 'not_called'
ORDER BY created_at ASC;
