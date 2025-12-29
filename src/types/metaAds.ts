/**
 * META ADS MANAGER TYPES - Professional Edition
 * Complete type definitions for Meta Marketing API v24.0 (2025)
 * @see https://developers.facebook.com/docs/marketing-api
 */

// ============================================
// CAMPAIGN TYPES
// ============================================

export type CampaignObjective =
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_APP_PROMOTION';

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';

export type EffectiveStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'DELETED'
  | 'ARCHIVED'
  | 'IN_PROCESS'
  | 'WITH_ISSUES'
  | 'PENDING_REVIEW'
  | 'DISAPPROVED'
  | 'PREAPPROVED'
  | 'PENDING_BILLING_INFO'
  | 'CAMPAIGN_PAUSED'
  | 'ADSET_PAUSED';

export type DeliveryStatus =
  | 'delivering'
  | 'not_delivering'
  | 'learning'
  | 'learning_limited'
  | 'inactive'
  | 'scheduled'
  | 'completed'
  | 'error';

export type BidStrategy =
  | 'LOWEST_COST_WITHOUT_CAP'
  | 'LOWEST_COST_WITH_BID_CAP'
  | 'COST_CAP'
  | 'LOWEST_COST_WITH_MIN_ROAS';

export type BuyingType = 'AUCTION' | 'RESERVED';

export type SpecialAdCategory = 'NONE' | 'EMPLOYMENT' | 'HOUSING' | 'CREDIT' | 'ISSUES_ELECTIONS_POLITICS';

export interface Campaign {
  id: string;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  effective_status?: EffectiveStatus;
  delivery_status?: DeliveryStatus;
  buying_type: BuyingType;
  bid_strategy?: BidStrategy;
  daily_budget?: number;
  lifetime_budget?: number;
  spend_cap?: number;
  special_ad_categories: SpecialAdCategory[];
  start_time?: string;
  stop_time?: string;
  created_time: string;
  updated_time: string;
  is_campaign_budget_optimization?: boolean;
  insights?: CampaignInsights;
  adsets_count?: number;
  ads_count?: number;
}

export interface CampaignInsights {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency?: number;
  conversions?: number;
  cost_per_conversion?: number;
  roas?: number;
  // v24.0 new metrics
  instagram_profile_visits?: number;
  actions?: ActionBreakdown[];
}

export interface ActionBreakdown {
  action_type: string;
  value: number;
}

// ============================================
// AD SET TYPES
// ============================================

export type OptimizationGoal =
  | 'REACH' | 'IMPRESSIONS' | 'LINK_CLICKS' | 'LANDING_PAGE_VIEWS'
  | 'POST_ENGAGEMENT' | 'PAGE_LIKES' | 'THRUPLAY' | 'VIDEO_VIEWS'
  | 'LEAD_GENERATION' | 'OFFSITE_CONVERSIONS' | 'ONSITE_CONVERSIONS' | 'VALUE' | 'APP_INSTALLS'
  | 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS' | 'CONVERSATIONS' | 'MESSAGING_PURCHASE_CONVERSION'
  // v24.0 optimization goals
  | 'QUALITY_CALL' | 'QUALITY_LEAD' | 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS'
  | 'VISIT_INSTAGRAM_PROFILE' | 'AD_RECALL_LIFT' | 'ENGAGED_USERS'
  | 'EVENT_RESPONSES' | 'REMINDERS_SET';

// Official billing events from Meta API docs v24.0
export type BillingEvent =
  | 'IMPRESSIONS'
  | 'LINK_CLICKS'
  | 'THRUPLAY'
  | 'PAGE_LIKES'
  | 'POST_ENGAGEMENT'
  | 'VIDEO_VIEWS'
  | 'APP_INSTALLS'
  | 'LEAD_GENERATION'
  | 'MESSAGING_CONVERSATIONS'
  | 'QUALIFIED_LEAD'
  | 'NONE'; // For certain optimization goals

// Destination types for ad sets (v24.0)
export type DestinationType =
  | 'WEBSITE'
  | 'APP'
  | 'MESSENGER'
  | 'WHATSAPP'
  | 'INSTAGRAM_DIRECT'
  | 'INSTAGRAM_PROFILE' // v24.0 new
  | 'PHONE_CALL'
  | 'SHOP'
  | 'ON_AD'
  | 'ON_POST'
  | 'ON_EVENT'
  | 'ON_VIDEO'
  | 'ON_PAGE'
  | 'FACEBOOK' // v24.0 new
  | 'APPLINKS_AUTOMATIC'; // v24.0 new

export type AdSetStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';

export interface AdSet {
  id: string;
  name: string;
  campaign_id: string;
  campaign?: Campaign;
  status: AdSetStatus;
  effective_status?: EffectiveStatus;
  delivery_status?: DeliveryStatus;
  optimization_goal: OptimizationGoal;
  billing_event: BillingEvent;
  bid_amount?: number;
  bid_strategy?: BidStrategy;
  daily_budget?: number;
  lifetime_budget?: number;
  start_time?: string;
  end_time?: string;
  targeting: TargetingSpec;
  promoted_object?: PromotedObject;
  destination_type?: DestinationType; // v24.0 - required for messaging/call ads
  attribution_spec?: AttributionSpec[]; // v24.0 - conversion attribution
  // v24.0 NEW fields
  is_adset_budget_sharing_enabled?: boolean; // Share up to 20% budget between ad sets
  placement_soft_opt_out?: boolean; // Allow 5% spend on excluded placements (Sales/Leads only)
  created_time: string;
  updated_time: string;
  insights?: AdSetInsights;
  ads_count?: number;
}

// Attribution specification for conversion tracking
export interface AttributionSpec {
  event_type: string;
  window_days: number;
}

export interface AdSetInsights {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency: number;
  conversions?: number;
  cost_per_conversion?: number;
}

// ============================================
// TARGETING TYPES
// ============================================

export interface TargetingSpec {
  geo_locations?: GeoLocations;
  excluded_geo_locations?: GeoLocations;
  age_min?: number;
  age_max?: number;
  genders?: (1 | 2)[];
  interests?: TargetingEntity[];
  behaviors?: TargetingEntity[];
  life_events?: TargetingEntity[];
  industries?: TargetingEntity[];
  income?: TargetingEntity[];
  family_statuses?: TargetingEntity[];
  education_statuses?: number[];
  relationship_statuses?: number[];
  custom_audiences?: { id: string; name?: string }[];
  excluded_custom_audiences?: { id: string; name?: string }[];
  flexible_spec?: FlexibleSpec[];
  exclusions?: FlexibleSpec;
  device_platforms?: ('mobile' | 'desktop')[];
  publisher_platforms?: ('facebook' | 'instagram' | 'audience_network' | 'messenger')[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  messenger_positions?: string[];
  audience_network_positions?: string[];
  threads_positions?: string[]; // v24.0 - Threads placements
  locales?: number[];
  targeting_optimization?: 'none' | 'expansion_all';
}

export interface GeoLocations {
  countries?: string[];
  regions?: { key: string; name?: string }[];
  cities?: { key: string; name?: string; radius?: number; distance_unit?: 'mile' | 'kilometer' }[];
  zips?: { key: string }[];
  location_types?: ('home' | 'recent' | 'travel_in')[];
}

export interface TargetingEntity {
  id: string | number;
  name: string;
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
  path?: string[];
  description?: string;
  topic?: string;
}

export interface FlexibleSpec {
  interests?: TargetingEntity[];
  behaviors?: TargetingEntity[];
  life_events?: TargetingEntity[];
}

export interface PromotedObject {
  page_id?: string;
  pixel_id?: string;
  pixel_rule?: string;
  application_id?: string;
  object_store_url?: string;
  instagram_profile_id?: string;
  lead_gen_form_id?: string;
  product_set_id?: string;
  offer_id?: string;
  custom_event_type?: string;
}

// ============================================
// AD TYPES
// ============================================

export type AdStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED' | 'PENDING_REVIEW' | 'DISAPPROVED' | 'PREAPPROVED';

export interface Ad {
  id: string;
  name: string;
  adset_id: string;
  adset?: AdSet;
  campaign_id?: string;
  campaign?: Campaign;
  creative: AdCreative;
  status: AdStatus;
  effective_status?: EffectiveStatus;
  delivery_status?: DeliveryStatus;
  created_time: string;
  updated_time: string;
  insights?: AdInsights;
  preview_shareable_link?: string;
}

export interface AdCreative {
  id?: string;
  name?: string;
  title?: string;
  body?: string;
  call_to_action_type?: CallToActionType;
  link_url?: string;
  image_hash?: string;
  image_url?: string;
  video_id?: string;
  thumbnail_url?: string;
  object_story_spec?: ObjectStorySpec;
  asset_feed_spec?: AssetFeedSpec;
  degrees_of_freedom_spec?: DegreesOfFreedomSpec;
  carousel_items?: CarouselItem[];
}

export interface CarouselItem {
  image_url?: string;
  title?: string;
  description?: string;
  link?: string;
}

export interface AssetFeedSpec {
  images?: { hash: string }[];
  videos?: { video_id: string; thumbnail_hash?: string }[];
  bodies?: { text: string }[];
  titles?: { text: string }[];
  descriptions?: { text: string }[];
  link_urls?: { website_url: string }[];
  call_to_action_types?: CallToActionType[];
}

// v24.0 - Advantage+ Creative enhancements
export interface DegreesOfFreedomSpec {
  creative_features_spec?: {
    standard_enhancements?: { enroll_status: 'OPT_IN' | 'OPT_OUT' };
    image_enhancement?: { enroll_status: 'OPT_IN' | 'OPT_OUT' };
    text_generation?: { enroll_status: 'OPT_IN' | 'OPT_OUT' };
    image_templates?: { enroll_status: 'OPT_IN' | 'OPT_OUT' };
    adapt_to_placement?: { enroll_status: 'OPT_IN' | 'OPT_OUT' };
  };
}

export interface ObjectStorySpec {
  page_id: string;
  instagram_actor_id?: string; // Required for Instagram-only ads
  link_data?: LinkData;
  photo_data?: PhotoData;
  video_data?: VideoData;
  text_data?: TextData; // For text-only ads
  template_data?: LinkData; // For dynamic/catalog ads
}

// Text-only ad data
export interface TextData {
  message?: string;
}

export interface PhotoData {
  image_hash?: string;
  url?: string;
  caption?: string;
}

export interface VideoData {
  video_id: string;
  title?: string;
  message?: string;
  image_hash?: string;
  image_url?: string; // Thumbnail URL for video
  call_to_action?: { type: CallToActionType; value?: { link?: string; page?: string } };
}

export interface ChildAttachment {
  link: string;
  name?: string;
  description?: string;
  image_hash?: string;
  picture?: string;
  call_to_action?: { type: CallToActionType; value?: { link?: string; page?: string } };
}

export interface LinkData {
  link: string;
  message?: string;
  name?: string;
  description?: string;
  caption?: string;
  image_hash?: string;
  picture?: string;
  call_to_action?: { type: CallToActionType; value?: { link?: string; page?: string } };
  child_attachments?: ChildAttachment[];
}

export type CallToActionType =
  | 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP' | 'SUBSCRIBE' | 'CONTACT_US'
  | 'DOWNLOAD' | 'GET_QUOTE' | 'BOOK_TRAVEL' | 'GET_OFFER' | 'GET_DIRECTIONS'
  | 'SEND_MESSAGE' | 'CALL_NOW' | 'WATCH_MORE' | 'APPLY_NOW' | 'BUY_NOW'
  | 'ORDER_NOW' | 'DONATE_NOW' | 'INSTALL_APP' | 'USE_APP' | 'PLAY_GAME'
  | 'REQUEST_TIME' | 'SEE_MENU' | 'WHATSAPP_MESSAGE' | 'GET_SHOWTIMES'
  | 'LIKE_PAGE' | 'MESSAGE_PAGE' | 'SEND_UPDATES' | 'GET_PROMOTIONS';

export interface AdInsights {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency?: number;
  conversions?: number;
  cost_per_conversion?: number;
  video_views?: number;
  video_p25_watched_actions?: number;
  video_p50_watched_actions?: number;
  video_p75_watched_actions?: number;
  video_p100_watched_actions?: number;
}

// ============================================
// MEDIA TYPES
// ============================================

export interface AdImage {
  hash: string;
  url: string;
  url_128?: string;
  width?: number;
  height?: number;
  name?: string;
  created_time?: string;
}

export interface AdVideo {
  id: string;
  title?: string;
  description?: string;
  source?: string;
  picture?: string;
  thumbnails?: { uri: string; height: number; width: number }[];
  length?: number;
  status?: {
    video_status: 'ready' | 'processing' | 'error';
    processing_progress?: number;
  };
  created_time?: string;
  updated_time?: string;
}

// ============================================
// AUDIENCE TYPES
// ============================================

export type AudienceSubtype =
  | 'CUSTOM'
  | 'WEBSITE'
  | 'APP'
  | 'ENGAGEMENT'
  | 'LOOKALIKE'
  | 'VIDEO'
  | 'LEAD_GEN_FORM'
  | 'INSTANT_EXPERIENCE'
  | 'SHOPPING'
  | 'IG_BUSINESS'
  | 'FB_EVENT'
  | 'OFFLINE';

export type AudienceOperationStatus =
  | 'NORMAL'
  | 'PROCESSING'
  | 'READY'
  | 'TOO_SMALL'
  | 'ERROR';

export interface CustomAudience {
  id: string;
  name: string;
  description?: string;
  subtype: AudienceSubtype;
  approximate_count?: number;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  operation_status?: AudienceOperationStatus;
  lookalike_spec?: LookalikeSpec;
  retention_days?: number;
  rule?: string;
  rule_aggregation?: string;
  time_created?: string;
  time_updated?: string;
  is_value_based?: boolean;
  data_source?: {
    type: string;
    sub_type?: string;
  };
}

export interface LookalikeSpec {
  country?: string;
  countries?: string[];
  ratio?: number;
  starting_ratio?: number;
  type?: 'custom_ratio' | 'similarity' | 'reach';
  origin_audience_id?: string;
  origin?: { id: string; name?: string; type?: string }[];
}

// ============================================
// AD ACCOUNT & REPORTING
// ============================================

export interface AdAccount {
  id: string;
  account_id: string;
  name: string;
  currency: string;
  timezone_name: string;
  timezone_offset_hours_utc?: number;
  amount_spent: string;
  balance: string;
  spend_cap?: string;
  account_status: number;
  business_name?: string;
  business_city?: string;
  business_country_code?: string;
  disable_reason?: number;
  funding_source?: string;
  min_campaign_group_spend_cap?: string;
  min_daily_budget?: number;
}

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week_sun_today'
  | 'this_week_mon_today'
  | 'last_week_sun_sat'
  | 'last_week_mon_sun'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d'
  | 'last_90d'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'lifetime'
  | 'maximum';

export type Breakdown =
  | 'age'
  | 'gender'
  | 'country'
  | 'region'
  | 'dma'
  | 'impression_device'
  | 'platform_position'
  | 'publisher_platform'
  | 'device_platform'
  | 'product_id'
  | 'hourly_stats_aggregated_by_advertiser_time_zone'
  | 'hourly_stats_aggregated_by_audience_time_zone';

export type ActionBreakdownType =
  | 'action_type'
  | 'action_target_id'
  | 'action_destination'
  | 'action_device'
  | 'action_reaction'
  | 'action_video_sound'
  | 'action_video_type';

export interface InsightsParams {
  date_preset?: DatePreset;
  time_range?: { since: string; until: string };
  time_increment?: number | 'monthly' | 'all_days';
  breakdowns?: Breakdown[];
  action_breakdowns?: ActionBreakdownType[];
  level?: 'account' | 'campaign' | 'adset' | 'ad';
  filtering?: { field: string; operator: string; value: string | string[] }[];
  sort?: string[];
  limit?: number;
}

export interface InsightsBreakdown {
  date_start: string;
  date_stop: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  // Breakdown dimensions
  age?: string;
  gender?: string;
  country?: string;
  region?: string;
  publisher_platform?: string;
  platform_position?: string;
  device_platform?: string;
  impression_device?: string;
}

// ============================================
// UI STATE TYPES
// ============================================

export interface MetaAdsState {
  adAccount: AdAccount | null;
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  audiences: CustomAudience[];
  images: AdImage[];
  videos: AdVideo[];
  loading: boolean;
  error: string | null;
  selectedCampaign: Campaign | null;
  selectedAdSet: AdSet | null;
  selectedAd: Ad | null;
  selectedItems: string[];
  viewMode: 'campaigns' | 'adsets' | 'ads';
  datePreset: DatePreset;
  customDateRange?: { since: string; until: string };
}

export interface TableColumn {
  id: string;
  label: string;
  accessor: string;
  type: 'text' | 'number' | 'currency' | 'percentage' | 'status' | 'date' | 'actions';
  sortable?: boolean;
  width?: number;
  minWidth?: number;
  visible?: boolean;
  frozen?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: any) => string | React.ReactNode;
}

export interface FilterConfig {
  field: string;
  operator: 'EQUAL' | 'NOT_EQUAL' | 'GREATER_THAN' | 'LESS_THAN' | 'IN' | 'NOT_IN' | 'CONTAINS';
  value: string | number | string[] | number[];
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface CampaignFormData {
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  buying_type: BuyingType;
  bid_strategy?: BidStrategy;
  budget_type: 'daily' | 'lifetime';
  budget_amount: number;
  special_ad_categories: SpecialAdCategory[];
  is_campaign_budget_optimization: boolean;
  start_time?: string;
  end_time?: string;
}

export interface AdSetFormData {
  name: string;
  campaign_id: string;
  status: AdSetStatus;
  optimization_goal: OptimizationGoal;
  billing_event: BillingEvent;
  bid_strategy?: BidStrategy;
  bid_amount?: number;
  budget_type: 'daily' | 'lifetime';
  budget_amount: number;
  start_time?: string;
  end_time?: string;
  targeting: TargetingSpec;
  promoted_object?: PromotedObject;
}

export interface AdFormData {
  name: string;
  adset_id: string;
  status: AdStatus;
  creative: AdCreative;
}

export interface AudienceFormData {
  name: string;
  description?: string;
  subtype: AudienceSubtype;
  retention_days?: number;
  rule?: AudienceRule;
  // Lookalike specific
  origin_audience_id?: string;
  countries?: string[];
  ratio?: number;
}

export interface AudienceRule {
  inclusions: AudienceRuleGroup;
  exclusions?: AudienceRuleGroup;
}

export interface AudienceRuleGroup {
  operator: 'or' | 'and';
  rules: AudienceRuleItem[];
}

export interface AudienceRuleItem {
  event_sources: { id: string; type: 'pixel' | 'app' | 'page' }[];
  retention_seconds: number;
  filter?: {
    operator: 'and' | 'or';
    filters: { field: string; operator: string; value: string | number }[];
  };
}

// ============================================
// CONSTANTS
// ============================================

export const CAMPAIGN_OBJECTIVES: { value: CampaignObjective; label: string; description: string; icon: string }[] = [
  { value: 'OUTCOME_AWARENESS', label: 'Awareness', description: 'Show ads to people most likely to remember them', icon: 'eye' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic', description: 'Send people to a destination like a website or app', icon: 'external-link' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement', description: 'Get more messages, video views, post engagement, or Page likes', icon: 'heart' },
  { value: 'OUTCOME_LEADS', label: 'Leads', description: 'Collect leads for your business via forms, calls, or chats', icon: 'user-plus' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion', description: 'Get people to install or take action in your app', icon: 'smartphone' },
  { value: 'OUTCOME_SALES', label: 'Sales', description: 'Find people likely to purchase your product or service', icon: 'shopping-cart' },
];

export const BID_STRATEGIES: { value: BidStrategy; label: string; description: string }[] = [
  { value: 'LOWEST_COST_WITHOUT_CAP', label: 'Highest Volume', description: 'Get the most results for your budget' },
  { value: 'COST_CAP', label: 'Cost Per Result Goal', description: 'Keep average cost per result around your target' },
  { value: 'LOWEST_COST_WITH_BID_CAP', label: 'Bid Cap', description: 'Set a maximum bid across auctions' },
  { value: 'LOWEST_COST_WITH_MIN_ROAS', label: 'ROAS Goal', description: 'Set a minimum return on ad spend' },
];

// Updated for Meta Marketing API v24.0
export const OPTIMIZATION_GOALS: { value: OptimizationGoal; label: string; objectives: CampaignObjective[]; billingEvent: BillingEvent }[] = [
  // Awareness objectives
  { value: 'REACH', label: 'Reach', objectives: ['OUTCOME_AWARENESS'], billingEvent: 'IMPRESSIONS' },
  { value: 'IMPRESSIONS', label: 'Impressions', objectives: ['OUTCOME_AWARENESS'], billingEvent: 'IMPRESSIONS' },
  { value: 'AD_RECALL_LIFT', label: 'Ad Recall Lift', objectives: ['OUTCOME_AWARENESS'], billingEvent: 'IMPRESSIONS' },
  { value: 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS', label: '2-Second Video Views', objectives: ['OUTCOME_AWARENESS', 'OUTCOME_ENGAGEMENT'], billingEvent: 'IMPRESSIONS' },
  { value: 'THRUPLAY', label: 'ThruPlay', objectives: ['OUTCOME_AWARENESS', 'OUTCOME_ENGAGEMENT'], billingEvent: 'THRUPLAY' },

  // Traffic objectives
  { value: 'LINK_CLICKS', label: 'Link Clicks', objectives: ['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT'], billingEvent: 'IMPRESSIONS' },
  { value: 'LANDING_PAGE_VIEWS', label: 'Landing Page Views', objectives: ['OUTCOME_TRAFFIC'], billingEvent: 'IMPRESSIONS' },
  { value: 'VISIT_INSTAGRAM_PROFILE', label: 'Instagram Profile Visits', objectives: ['OUTCOME_TRAFFIC'], billingEvent: 'IMPRESSIONS' },

  // Engagement objectives
  { value: 'POST_ENGAGEMENT', label: 'Post Engagement', objectives: ['OUTCOME_ENGAGEMENT'], billingEvent: 'IMPRESSIONS' },
  { value: 'PAGE_LIKES', label: 'Page Likes', objectives: ['OUTCOME_ENGAGEMENT'], billingEvent: 'IMPRESSIONS' },
  { value: 'EVENT_RESPONSES', label: 'Event Responses', objectives: ['OUTCOME_ENGAGEMENT'], billingEvent: 'IMPRESSIONS' },
  { value: 'REMINDERS_SET', label: 'Reminders Set', objectives: ['OUTCOME_ENGAGEMENT'], billingEvent: 'IMPRESSIONS' },

  // Lead objectives
  { value: 'LEAD_GENERATION', label: 'Leads', objectives: ['OUTCOME_LEADS'], billingEvent: 'IMPRESSIONS' },
  { value: 'QUALITY_LEAD', label: 'Quality Leads', objectives: ['OUTCOME_LEADS'], billingEvent: 'IMPRESSIONS' },
  { value: 'CONVERSATIONS', label: 'Conversations', objectives: ['OUTCOME_LEADS', 'OUTCOME_ENGAGEMENT'], billingEvent: 'IMPRESSIONS' },
  { value: 'QUALITY_CALL', label: 'Quality Calls', objectives: ['OUTCOME_LEADS', 'OUTCOME_ENGAGEMENT', 'OUTCOME_SALES'], billingEvent: 'IMPRESSIONS' },

  // Sales objectives
  { value: 'OFFSITE_CONVERSIONS', label: 'Conversions', objectives: ['OUTCOME_SALES', 'OUTCOME_LEADS'], billingEvent: 'IMPRESSIONS' },
  { value: 'VALUE', label: 'Value', objectives: ['OUTCOME_SALES'], billingEvent: 'IMPRESSIONS' },

  // App objectives
  { value: 'APP_INSTALLS', label: 'App Installs', objectives: ['OUTCOME_APP_PROMOTION'], billingEvent: 'IMPRESSIONS' },
];

export const PLACEMENTS = {
  facebook: [
    { value: 'feed', label: 'Facebook Feed' },
    { value: 'right_hand_column', label: 'Right Column' },
    { value: 'marketplace', label: 'Marketplace' },
    { value: 'video_feeds', label: 'Video Feeds' },
    { value: 'story', label: 'Stories' },
    { value: 'reels', label: 'Reels' },
    { value: 'search', label: 'Search Results' },
    { value: 'instream_video', label: 'In-Stream Videos' },
  ],
  instagram: [
    { value: 'stream', label: 'Instagram Feed' },
    { value: 'story', label: 'Stories' },
    { value: 'explore', label: 'Explore' },
    { value: 'explore_home', label: 'Explore Home' },
    { value: 'reels', label: 'Reels' },
    { value: 'profile_feed', label: 'Profile Feed' },
    { value: 'shop', label: 'Shop' },
  ],
  messenger: [
    { value: 'messenger_home', label: 'Messenger Inbox' },
    { value: 'story', label: 'Messenger Stories' },
    { value: 'sponsored_messages', label: 'Sponsored Messages' },
  ],
  audience_network: [
    { value: 'classic', label: 'Native, Banner and Interstitial' },
    { value: 'rewarded_video', label: 'Rewarded Videos' },
  ],
  // v24.0 - Threads placements
  threads: [
    { value: 'threads_stream', label: 'Threads Feed' },
  ],
};

export const CALL_TO_ACTIONS: { value: CallToActionType; label: string; category: string }[] = [
  { value: 'LEARN_MORE', label: 'Learn More', category: 'general' },
  { value: 'SHOP_NOW', label: 'Shop Now', category: 'ecommerce' },
  { value: 'SIGN_UP', label: 'Sign Up', category: 'lead' },
  { value: 'SUBSCRIBE', label: 'Subscribe', category: 'lead' },
  { value: 'CONTACT_US', label: 'Contact Us', category: 'lead' },
  { value: 'DOWNLOAD', label: 'Download', category: 'app' },
  { value: 'GET_QUOTE', label: 'Get Quote', category: 'lead' },
  { value: 'BOOK_TRAVEL', label: 'Book Now', category: 'booking' },
  { value: 'GET_OFFER', label: 'Get Offer', category: 'ecommerce' },
  { value: 'GET_DIRECTIONS', label: 'Get Directions', category: 'local' },
  { value: 'SEND_MESSAGE', label: 'Send Message', category: 'messaging' },
  { value: 'WHATSAPP_MESSAGE', label: 'WhatsApp', category: 'messaging' },
  { value: 'CALL_NOW', label: 'Call Now', category: 'local' },
  { value: 'WATCH_MORE', label: 'Watch More', category: 'video' },
  { value: 'APPLY_NOW', label: 'Apply Now', category: 'lead' },
  { value: 'BUY_NOW', label: 'Buy Now', category: 'ecommerce' },
  { value: 'ORDER_NOW', label: 'Order Now', category: 'ecommerce' },
  { value: 'DONATE_NOW', label: 'Donate Now', category: 'nonprofit' },
  { value: 'INSTALL_APP', label: 'Install App', category: 'app' },
  { value: 'USE_APP', label: 'Use App', category: 'app' },
  { value: 'PLAY_GAME', label: 'Play Game', category: 'gaming' },
  { value: 'REQUEST_TIME', label: 'Request Time', category: 'booking' },
  { value: 'SEE_MENU', label: 'See Menu', category: 'local' },
  { value: 'GET_SHOWTIMES', label: 'Get Showtimes', category: 'entertainment' },
  { value: 'LIKE_PAGE', label: 'Like Page', category: 'engagement' },
  { value: 'MESSAGE_PAGE', label: 'Message Page', category: 'messaging' },
  { value: 'SEND_UPDATES', label: 'Send Updates', category: 'messaging' },
  { value: 'GET_PROMOTIONS', label: 'Get Promotions', category: 'ecommerce' },
];

export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PH', name: 'Philippines' },
  { code: 'ID', name: 'Indonesia' },
];

export const AGE_RANGES = [
  { min: 18, max: 24, label: '18-24' },
  { min: 25, max: 34, label: '25-34' },
  { min: 35, max: 44, label: '35-44' },
  { min: 45, max: 54, label: '45-54' },
  { min: 55, max: 64, label: '55-64' },
  { min: 65, max: 65, label: '65+' },
];

export const GENDERS = [
  { value: 0, label: 'All' },
  { value: 1, label: 'Male' },
  { value: 2, label: 'Female' },
];

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7d', label: 'Last 7 Days' },
  { value: 'last_14d', label: 'Last 14 Days' },
  { value: 'last_30d', label: 'Last 30 Days' },
  { value: 'last_90d', label: 'Last 90 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'lifetime', label: 'Lifetime' },
  { value: 'maximum', label: 'Maximum' },
];

export const BREAKDOWNS: { value: Breakdown; label: string; category: string }[] = [
  { value: 'age', label: 'Age', category: 'demographics' },
  { value: 'gender', label: 'Gender', category: 'demographics' },
  { value: 'country', label: 'Country', category: 'geography' },
  { value: 'region', label: 'Region', category: 'geography' },
  { value: 'dma', label: 'DMA Region', category: 'geography' },
  { value: 'publisher_platform', label: 'Platform', category: 'delivery' },
  { value: 'platform_position', label: 'Placement', category: 'delivery' },
  { value: 'device_platform', label: 'Device', category: 'delivery' },
  { value: 'impression_device', label: 'Impression Device', category: 'delivery' },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getDeliveryStatusColor(status?: DeliveryStatus): string {
  const colors: Record<DeliveryStatus, string> = {
    delivering: 'bg-green-500',
    learning: 'bg-blue-500',
    learning_limited: 'bg-yellow-500',
    not_delivering: 'bg-gray-500',
    inactive: 'bg-gray-400',
    scheduled: 'bg-purple-500',
    completed: 'bg-gray-600',
    error: 'bg-red-500',
  };
  return status ? colors[status] : 'bg-gray-400';
}

export function getDeliveryStatusLabel(status?: DeliveryStatus): string {
  const labels: Record<DeliveryStatus, string> = {
    delivering: 'Delivering',
    learning: 'Learning',
    learning_limited: 'Learning Limited',
    not_delivering: 'Not Delivering',
    inactive: 'Inactive',
    scheduled: 'Scheduled',
    completed: 'Completed',
    error: 'Error',
  };
  return status ? labels[status] : 'Unknown';
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}
