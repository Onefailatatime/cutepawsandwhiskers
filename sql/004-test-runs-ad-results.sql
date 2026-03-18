-- Test Runs (experiments)
CREATE TABLE test_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL,
  name TEXT NOT NULL,
  channel TEXT DEFAULT 'Facebook',
  objective TEXT,
  audience TEXT,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  decision TEXT CHECK (decision IN ('kill', 'iterate', 'scale')),
  decision_why TEXT,
  is_finished BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad Results (per-ad snapshots within a test)
CREATE TABLE ad_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
  fb_ad_id TEXT,
  utm_content TEXT,
  spend NUMERIC(10,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC(6,3) DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  cac_front NUMERIC(10,2) DEFAULT 0,
  upsell_revenue NUMERIC(10,2) DEFAULT 0,
  r30 NUMERIC(10,2) DEFAULT 0,
  payback_ratio NUMERIC(6,3) DEFAULT 0,
  status TEXT CHECK (status IN ('winner', 'loser', 'needs_data')) DEFAULT 'needs_data',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all test_runs" ON test_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ad_results" ON ad_results FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_test_runs_campaign ON test_runs(campaign_id);
CREATE INDEX idx_ad_results_test_run ON ad_results(test_run_id);
