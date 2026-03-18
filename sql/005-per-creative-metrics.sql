-- Tag daily metrics to a specific creative
ALTER TABLE ad_daily_metrics ADD COLUMN IF NOT EXISTS creative_id UUID REFERENCES campaign_creatives(id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_creative ON ad_daily_metrics(creative_id);

-- Add decision tracking to creatives
ALTER TABLE campaign_creatives ADD COLUMN IF NOT EXISTS decision TEXT CHECK (decision IN ('kill', 'iterate', 'scale'));
ALTER TABLE campaign_creatives ADD COLUMN IF NOT EXISTS decision_why TEXT;
ALTER TABLE campaign_creatives ADD COLUMN IF NOT EXISTS stopped_at DATE;
