-- Add description field to campaign_creatives
ALTER TABLE campaign_creatives ADD COLUMN IF NOT EXISTS description TEXT;
