-- ============================================================
-- Ad Daily Metrics — track daily Facebook ad performance
-- Run this in Supabase SQL Editor
-- ============================================================

-- Daily ad metrics table for logging Facebook ad results
CREATE TABLE IF NOT EXISTS ad_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  impressions int DEFAULT 0,
  reach int DEFAULT 0,
  clicks int DEFAULT 0,
  link_clicks int DEFAULT 0,
  spend numeric(10,2) DEFAULT 0,
  cpm numeric(10,2) DEFAULT 0,
  cpc numeric(10,2) DEFAULT 0,
  ctr numeric(6,3) DEFAULT 0,
  frequency numeric(6,2) DEFAULT 0,
  leads int DEFAULT 0,
  purchases int DEFAULT 0,
  cost_per_lead numeric(10,2) DEFAULT 0,
  cost_per_purchase numeric(10,2) DEFAULT 0,
  thumb_stop_ratio numeric(6,2) DEFAULT 0,
  video_views_3s int DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, metric_date)
);

ALTER TABLE ad_daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for ad_daily_metrics" ON ad_daily_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ad_daily_metrics_campaign_date ON ad_daily_metrics(campaign_id, metric_date);

-- Campaign performance summary view
CREATE OR REPLACE VIEW campaign_performance AS
SELECT
  ac.id,
  ac.name,
  ac.platform,
  ac.status,
  ac.daily_budget,
  ac.total_spend AS budget_total_spend,
  ac.start_date,
  ac.end_date,
  ac.image_url,
  COALESCE(SUM(dm.impressions), 0) AS total_impressions,
  COALESCE(SUM(dm.reach), 0) AS total_reach,
  COALESCE(SUM(dm.clicks), 0) AS total_clicks,
  COALESCE(SUM(dm.link_clicks), 0) AS total_link_clicks,
  COALESCE(SUM(dm.spend), 0) AS total_spend,
  COALESCE(SUM(dm.video_views_3s), 0) AS total_video_views_3s,
  COUNT(DISTINCT dm.metric_date) AS days_tracked,
  CASE WHEN SUM(dm.impressions) > 0
    THEN ROUND(SUM(dm.clicks)::numeric / SUM(dm.impressions) * 100, 2)
    ELSE 0 END AS avg_ctr,
  CASE WHEN SUM(dm.clicks) > 0
    THEN ROUND(SUM(dm.spend) / SUM(dm.clicks), 2)
    ELSE 0 END AS avg_cpc,
  CASE WHEN SUM(dm.impressions) > 0
    THEN ROUND(SUM(dm.spend) / SUM(dm.impressions) * 1000, 2)
    ELSE 0 END AS avg_cpm,
  CASE WHEN SUM(dm.reach) > 0
    THEN ROUND(SUM(dm.impressions)::numeric / SUM(dm.reach), 2)
    ELSE 0 END AS avg_frequency,
  COUNT(DISTINCT ce.id) AS total_entries,
  COUNT(DISTINCT ce.id) FILTER (WHERE ce.payment_confirmed = true) AS paid_entries,
  COALESCE(SUM(DISTINCT ce.total_price) FILTER (WHERE ce.payment_confirmed = true), 0) AS entry_revenue,
  CASE WHEN COUNT(DISTINCT ce.id) FILTER (WHERE ce.payment_confirmed = true) > 0
    THEN ROUND(SUM(dm.spend) / COUNT(DISTINCT ce.id) FILTER (WHERE ce.payment_confirmed = true), 2)
    ELSE 0 END AS cpa,
  CASE WHEN SUM(dm.spend) > 0
    THEN ROUND(COALESCE(SUM(DISTINCT ce.total_price) FILTER (WHERE ce.payment_confirmed = true), 0) / SUM(dm.spend), 2)
    ELSE 0 END AS roas,
  CASE WHEN COUNT(DISTINCT dm.metric_date) > 0
    THEN ROUND(SUM(dm.spend) / COUNT(DISTINCT dm.metric_date), 2)
    ELSE 0 END AS avg_daily_spend
FROM ad_campaigns ac
LEFT JOIN ad_daily_metrics dm ON dm.campaign_id = ac.id
LEFT JOIN contest_entries ce ON ce.campaign_id = ac.id
GROUP BY ac.id, ac.name, ac.platform, ac.status, ac.daily_budget, ac.total_spend, ac.start_date, ac.end_date, ac.image_url;
