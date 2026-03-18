-- Campaign Hub Migration
-- Adds goal tracking, archive lifecycle, creatives, and notes journal

-- Add campaign hub fields to ad_campaigns
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS goal_type text DEFAULT 'sign_ups',
  ADD COLUMN IF NOT EXISTS goal_target numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_label text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS hub_notes text DEFAULT '';

-- Campaign creatives table (multiple ads per campaign)
CREATE TABLE IF NOT EXISTS campaign_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  creative_type text DEFAULT 'image',
  image_url text DEFAULT '',
  video_url text DEFAULT '',
  headline text DEFAULT '',
  body_text text DEFAULT '',
  cta_text text DEFAULT '',
  utm_content text DEFAULT '',
  fb_ad_id text DEFAULT '',
  is_active boolean DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE campaign_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for campaign_creatives" ON campaign_creatives FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_campaign_creatives_campaign ON campaign_creatives(campaign_id);

-- Campaign notes / journal table
CREATE TABLE IF NOT EXISTS campaign_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  note_text text NOT NULL DEFAULT '',
  note_type text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE campaign_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for campaign_notes" ON campaign_notes FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_campaign_notes_campaign ON campaign_notes(campaign_id);
