-- Meta Ads v24.0 Database Migration
-- Run this in Supabase SQL Editor to align database with Meta Marketing API v24.0

-- ============================================================================
-- 1. ADD V24.0 FIELDS TO META_ADSETS
-- ============================================================================
ALTER TABLE public.meta_adsets 
ADD COLUMN IF NOT EXISTS is_adset_budget_sharing_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS placement_soft_opt_out text[];

-- ============================================================================
-- 2. ADD BUDGET FIELD TO META_CAMPAIGNS
-- ============================================================================
ALTER TABLE public.meta_campaigns
ADD COLUMN IF NOT EXISTS budget bigint;

-- ============================================================================
-- 3. ADD PREVIEW_URL TO META_ADS
-- ============================================================================
ALTER TABLE public.meta_ads
ADD COLUMN IF NOT EXISTS preview_url text;

-- ============================================================================
-- 4. ADD PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_objective ON public.meta_campaigns(objective);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status ON public.meta_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_user_id ON public.meta_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_workspace_id ON public.meta_campaigns(workspace_id);

CREATE INDEX IF NOT EXISTS idx_meta_adsets_optimization_goal ON public.meta_adsets(optimization_goal);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_status ON public.meta_adsets(status);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign_id ON public.meta_adsets(meta_campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_user_id ON public.meta_adsets(user_id);

CREATE INDEX IF NOT EXISTS idx_meta_ads_status ON public.meta_ads(status);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset_id ON public.meta_ads(meta_adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign_id ON public.meta_ads(meta_campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_user_id ON public.meta_ads(user_id);

CREATE INDEX IF NOT EXISTS idx_meta_ad_drafts_status ON public.meta_ad_drafts(status);
CREATE INDEX IF NOT EXISTS idx_meta_ad_drafts_user_id ON public.meta_ad_drafts(user_id);

-- ============================================================================
-- 5. ADD COLUMN COMMENTS FOR V24.0 DOCUMENTATION
-- ============================================================================
COMMENT ON COLUMN public.meta_adsets.is_adset_budget_sharing_enabled IS 'v24.0: Allow up to 20% budget sharing across ad sets';
COMMENT ON COLUMN public.meta_adsets.placement_soft_opt_out IS 'v24.0: Placements that can receive up to 5% of spend even when excluded';
COMMENT ON COLUMN public.meta_campaigns.insights IS 'v24.0 insights: instagram_profile_visits, roas, frequency, conversions';
COMMENT ON COLUMN public.meta_adsets.insights IS 'v24.0 insights: instagram_profile_visits, roas, frequency, conversions';
COMMENT ON COLUMN public.meta_ads.insights IS 'v24.0 insights: ctr, cpm, cpc, conversions, roas';
