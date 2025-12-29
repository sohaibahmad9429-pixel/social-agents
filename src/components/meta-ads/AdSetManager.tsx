'use client';

import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Target,
  MapPin,
  Users,
  Calendar,
  DollarSign,
  Play,
  Pause,
  Edit,
  MoreHorizontal,
  X,
  ChevronRight,
  Globe,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  AdSet,
  Campaign,
  AdSetFormData,
  TargetingSpec,
  OptimizationGoal,
  BillingEvent,
  AdSetStatus,
  BidStrategy,
} from '@/types/metaAds';

interface AdSetManagerProps {
  adSets: AdSet[];
  campaigns: Campaign[];
  onRefresh: () => void;
  showCreate?: boolean;
  onShowCreateChange?: (show: boolean) => void;
  preselectedCampaignId?: string;
}

// Optimization goals mapped to campaign objectives - v24.0
// Each objective has valid goals, with the first being the default
const OBJECTIVE_OPTIMIZATION_GOALS: Record<string, { value: string; label: string; description: string }[]> = {
  'OUTCOME_AWARENESS': [
    { value: 'REACH', label: 'Reach', description: 'Show ads to maximum unique people' },
    { value: 'IMPRESSIONS', label: 'Impressions', description: 'Show ads as many times as possible' },
    { value: 'AD_RECALL_LIFT', label: 'Ad Recall Lift', description: 'Maximize brand recall' },
    { value: 'THRUPLAY', label: 'ThruPlay', description: 'Video views (15+ seconds)' },
    { value: 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS', label: '2-Second Views', description: 'Video views (2+ seconds)' },
  ],
  'OUTCOME_TRAFFIC': [
    { value: 'LINK_CLICKS', label: 'Link Clicks', description: 'Get people to click your link' },
    { value: 'LANDING_PAGE_VIEWS', label: 'Landing Page Views', description: 'Get people to view your landing page' },
    { value: 'REACH', label: 'Reach', description: 'Show ads to maximum people' },
    { value: 'IMPRESSIONS', label: 'Impressions', description: 'Maximize impressions' },
  ],
  'OUTCOME_ENGAGEMENT': [
    { value: 'POST_ENGAGEMENT', label: 'Post Engagement', description: 'Get likes, comments, shares' },
    { value: 'THRUPLAY', label: 'ThruPlay', description: 'Get video views (15+ seconds)' },
    { value: 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS', label: '2-Second Views', description: 'Quick video views' },
    { value: 'PAGE_LIKES', label: 'Page Likes', description: 'Grow your Page followers' },
    { value: 'EVENT_RESPONSES', label: 'Event Responses', description: 'Get event RSVPs' },
    { value: 'CONVERSATIONS', label: 'Conversations', description: 'Start messaging conversations' },
  ],
  'OUTCOME_LEADS': [
    { value: 'LEAD_GENERATION', label: 'Lead Generation', description: 'Collect leads with forms' },
    { value: 'QUALITY_LEAD', label: 'Quality Leads', description: 'Higher quality lead form submissions' },
    { value: 'CONVERSATIONS', label: 'Conversations', description: 'Start messaging conversations' },
    { value: 'LINK_CLICKS', label: 'Link Clicks', description: 'Drive traffic to your website' },
    { value: 'OFFSITE_CONVERSIONS', label: 'Website Conversions', description: 'Track website conversions' },
    { value: 'ONSITE_CONVERSIONS', label: 'On-Site Conversions', description: 'In-app conversions' },
  ],
  'OUTCOME_SALES': [
    { value: 'OFFSITE_CONVERSIONS', label: 'Website Conversions', description: 'Optimize for purchases' },
    { value: 'ONSITE_CONVERSIONS', label: 'On-Site Conversions', description: 'In-app purchases' },
    { value: 'VALUE', label: 'Value', description: 'Maximize purchase value' },
    { value: 'LINK_CLICKS', label: 'Link Clicks', description: 'Drive traffic to your website' },
    { value: 'LANDING_PAGE_VIEWS', label: 'Landing Page Views', description: 'Get people to view your page' },
  ],
  'OUTCOME_APP_PROMOTION': [
    { value: 'APP_INSTALLS', label: 'App Installs', description: 'Get people to install your app' },
    { value: 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS', label: 'App Events', description: 'In-app actions' },
    { value: 'LINK_CLICKS', label: 'Link Clicks', description: 'Get clicks to app store' },
    { value: 'REACH', label: 'Reach', description: 'Show ads to maximum people' },
  ],
};

// Fallback for unknown objectives
const DEFAULT_OPTIMIZATION_GOALS = [
  { value: 'LINK_CLICKS', label: 'Link Clicks', description: 'Get people to click your link' },
  { value: 'REACH', label: 'Reach', description: 'Show ads to maximum people' },
];

// Valid facebook_positions for Meta API v24.0
// Note: 'reels' is NOT valid for facebook_positions - use 'facebook_reels_overlay' or omit
const PLACEMENTS = {
  facebook: [
    { id: 'feed', label: 'Facebook Feed' },
    { id: 'story', label: 'Facebook Stories' },
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'video_feeds', label: 'Video Feeds' },
    { id: 'right_hand_column', label: 'Right Column' },
    { id: 'search', label: 'Search Results' },
    { id: 'instream_video', label: 'In-Stream Video' },
  ],
  instagram: [
    { id: 'stream', label: 'Instagram Feed' },
    { id: 'story', label: 'Instagram Stories' },
    { id: 'reels', label: 'Instagram Reels' },
    { id: 'explore', label: 'Explore' },
    { id: 'ig_search', label: 'Search Results' },
  ],
};

const initialFormData: AdSetFormData = {
  name: '',
  campaign_id: '',
  status: 'PAUSED',
  optimization_goal: 'LINK_CLICKS',
  billing_event: 'IMPRESSIONS',
  budget_type: 'daily',
  budget_amount: 10,
  bid_strategy: 'LOWEST_COST_WITHOUT_CAP', // Default - no bid amount needed
  targeting: {
    age_min: 18,
    age_max: 65,
    genders: [],
    geo_locations: { countries: ['US'] },
    device_platforms: ['mobile', 'desktop'],
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed', 'story'],
    instagram_positions: ['stream', 'story', 'reels'],
  },
};

export default function AdSetManager({ adSets, campaigns, onRefresh, showCreate, onShowCreateChange, preselectedCampaignId }: AdSetManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formData, setFormData] = useState<AdSetFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync with external showCreate prop
  React.useEffect(() => {
    if (showCreate !== undefined) {
      setShowCreateModal(showCreate);
    }
  }, [showCreate]);

  // Pre-select campaign if provided
  React.useEffect(() => {
    if (preselectedCampaignId && showCreate) {
      setFormData(prev => ({ ...prev, campaign_id: preselectedCampaignId }));
    }
  }, [preselectedCampaignId, showCreate]);

  const handleModalChange = (show: boolean) => {
    setShowCreateModal(show);
    onShowCreateChange?.(show);
  };

  const filteredAdSets = adSets.filter(adSet => {
    const matchesSearch = adSet.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || adSet.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateAdSet = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/meta-ads/adsets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        handleModalChange(false);
        setFormData(initialFormData);
        onRefresh();
      } else {
        // Show error to user
        alert(`Failed to create ad set: ${data.message || data.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('Failed to create ad set. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (adSetId: string, newStatus: AdSetStatus) => {
    try {
      await fetch(`/api/meta-ads/adsets/${adSetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      onRefresh();
    } catch (error) {
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Ad Sets</h2>
          <p className="text-muted-foreground">Configure targeting, budget, and placements</p>
        </div>
        <Button
          onClick={() => handleModalChange(true)}
          className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Ad Set
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search ad sets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Ad Sets Grid */}
      {filteredAdSets.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredAdSets.map((adSet) => (
            <AdSetCard
              key={adSet.id}
              adSet={adSet}
              campaign={campaigns.find(c => c.id === adSet.campaign_id)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Target className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No ad sets found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Create your first ad set to define targeting'}
              </p>
              <Button onClick={() => handleModalChange(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Ad Set
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Ad Set Modal */}
      {showCreateModal && (
        <CreateAdSetModal
          formData={formData}
          setFormData={setFormData}
          campaigns={campaigns}
          onClose={() => {
            handleModalChange(false);
            setFormData(initialFormData);
          }}
          onSubmit={handleCreateAdSet}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}

function AdSetCard({
  adSet,
  campaign,
  onStatusChange,
}: {
  adSet: AdSet;
  campaign?: Campaign;
  onStatusChange: (id: string, status: AdSetStatus) => void;
}) {
  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PAUSED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    DELETED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    ARCHIVED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };

  const targeting = adSet.targeting;
  const locations = targeting?.geo_locations?.countries?.join(', ') || 'All';
  const ageRange = `${targeting?.age_min || 18}-${targeting?.age_max || 65}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">{adSet.name}</CardTitle>
              <CardDescription className="text-xs">
                {campaign?.name || 'No campaign'}
              </CardDescription>
            </div>
          </div>
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", statusColors[adSet.status])}>
            {adSet.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Targeting Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Location:</span>
            <span className="font-medium">{locations}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Age:</span>
            <span className="font-medium">{ageRange}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Budget:</span>
            <span className="font-medium">
              ${adSet.daily_budget ? (adSet.daily_budget / 100).toFixed(2) : '0'}/day
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Goal:</span>
            <span className="font-medium">{adSet.optimization_goal.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* Metrics */}
        {adSet.insights && (
          <div className="grid grid-cols-4 gap-2 pt-3 border-t">
            <div className="text-center">
              <p className="text-lg font-bold">{formatNumber(adSet.insights.impressions)}</p>
              <p className="text-xs text-muted-foreground">Impressions</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{formatNumber(adSet.insights.reach)}</p>
              <p className="text-xs text-muted-foreground">Reach</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{formatNumber(adSet.insights.clicks)}</p>
              <p className="text-xs text-muted-foreground">Clicks</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">${adSet.insights.spend.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Spend</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {adSet.status === 'ACTIVE' ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={() => onStatusChange(adSet.id, 'PAUSED')}
            >
              <Pause className="w-4 h-4" />
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={() => onStatusChange(adSet.id, 'ACTIVE')}
            >
              <Play className="w-4 h-4" />
              Activate
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1 gap-2">
            <Edit className="w-4 h-4" />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateAdSetModal({
  formData,
  setFormData,
  campaigns,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  formData: AdSetFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdSetFormData>>;
  campaigns: Campaign[];
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const [step, setStep] = useState(1);

  const updateTargeting = (updates: Partial<TargetingSpec>) => {
    setFormData(prev => ({
      ...prev,
      targeting: { ...prev.targeting, ...updates },
    }));
  };

  // Check if selected campaign uses Campaign Budget Optimization (CBO)
  const selectedCampaign = campaigns.find(c => c.id === formData.campaign_id);
  const campaignUsesCBO = !!(selectedCampaign?.daily_budget || selectedCampaign?.lifetime_budget);

  // Check if campaign's bid_strategy requires bid_amount
  const strategiesRequiringBidAmount = ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS'];
  const campaignRequiresBidAmount = selectedCampaign?.bid_strategy &&
    strategiesRequiringBidAmount.includes(selectedCampaign.bid_strategy);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Create Ad Set</h2>
            <p className="text-sm text-muted-foreground">Step {step} of 4 - {
              step === 1 ? 'Basic Info' :
                step === 2 ? 'Targeting' :
                  step === 3 ? 'Placements' :
                    'Budget & Schedule'
            }</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  s <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[55vh]">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="adset-name">Ad Set Name</Label>
                <Input
                  id="adset-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter ad set name"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Campaign</Label>
                <Select
                  value={formData.campaign_id}
                  onValueChange={(value) => {
                    // Find the selected campaign and set the default optimization goal
                    const selectedCampaign = campaigns.find(c => c.id === value);
                    const defaultGoals = selectedCampaign?.objective
                      ? (OBJECTIVE_OPTIMIZATION_GOALS[selectedCampaign.objective] || DEFAULT_OPTIMIZATION_GOALS)
                      : DEFAULT_OPTIMIZATION_GOALS;
                    const defaultGoal = defaultGoals[0]?.value || 'LINK_CLICKS';

                    setFormData(prev => ({
                      ...prev,
                      campaign_id: value,
                      optimization_goal: defaultGoal as OptimizationGoal
                    }));
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name} ({campaign.objective?.replace('OUTCOME_', '')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Optimization Goal</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Available goals based on your campaign objective
                </p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {(() => {
                    const selectedCampaign = campaigns.find(c => c.id === formData.campaign_id);
                    const goals = selectedCampaign?.objective
                      ? (OBJECTIVE_OPTIMIZATION_GOALS[selectedCampaign.objective] || DEFAULT_OPTIMIZATION_GOALS)
                      : DEFAULT_OPTIMIZATION_GOALS;
                    return goals.map((goal: { value: string; label: string; description: string }) => (
                      <button
                        key={goal.value}
                        onClick={() => setFormData(prev => ({ ...prev, optimization_goal: goal.value as OptimizationGoal }))}
                        className={cn(
                          "p-3 rounded-xl border-2 text-left transition-all",
                          formData.optimization_goal === goal.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <p className="font-medium text-sm">{goal.label}</p>
                        <p className="text-xs text-muted-foreground">{goal.description}</p>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Location */}
              <div>
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Locations
                </Label>
                <Input
                  placeholder="Search for countries, regions, or cities..."
                  className="mt-2"
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {['US', 'CA', 'GB', 'AU', 'DE', 'FR'].map((country) => (
                    <button
                      key={country}
                      onClick={() => {
                        const countries = formData.targeting.geo_locations?.countries || [];
                        const newCountries = countries.includes(country)
                          ? countries.filter(c => c !== country)
                          : [...countries, country];
                        updateTargeting({
                          geo_locations: { ...formData.targeting.geo_locations, countries: newCountries }
                        });
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        formData.targeting.geo_locations?.countries?.includes(country)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {country}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age & Gender */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Age Range</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      value={formData.targeting.age_min || 18}
                      onChange={(e) => updateTargeting({ age_min: parseInt(e.target.value) })}
                      min={13}
                      max={65}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="number"
                      value={formData.targeting.age_max || 65}
                      onChange={(e) => updateTargeting({ age_max: parseInt(e.target.value) })}
                      min={13}
                      max={65}
                      className="w-20"
                    />
                  </div>
                </div>
                <div>
                  <Label>Gender</Label>
                  <div className="flex gap-2 mt-2">
                    {[
                      { value: [], label: 'All' },
                      { value: [1], label: 'Male' },
                      { value: [2], label: 'Female' },
                    ].map((option) => (
                      <button
                        key={option.label}
                        onClick={() => updateTargeting({ genders: option.value as (1 | 2)[] })}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1",
                          JSON.stringify(formData.targeting.genders) === JSON.stringify(option.value)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interests */}
              <div>
                <Label className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Detailed Targeting (Interests & Behaviors)
                </Label>
                <Input
                  placeholder="Search interests, behaviors, demographics..."
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Add interests like "Technology", "Fitness", "Travel" to narrow your audience
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              {/* Device Platforms */}
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Smartphone className="w-4 h-4" />
                  Device Platforms
                </Label>
                <div className="flex gap-3">
                  {[
                    { value: 'mobile', label: 'Mobile', icon: Smartphone },
                    { value: 'desktop', label: 'Desktop', icon: Monitor },
                  ].map((device) => (
                    <button
                      key={device.value}
                      onClick={() => {
                        const platforms = formData.targeting.device_platforms || [];
                        const newPlatforms = platforms.includes(device.value as 'mobile' | 'desktop')
                          ? platforms.filter(p => p !== device.value)
                          : [...platforms, device.value as 'mobile' | 'desktop'];
                        updateTargeting({ device_platforms: newPlatforms });
                      }}
                      className={cn(
                        "flex-1 p-4 rounded-xl border-2 transition-all",
                        formData.targeting.device_platforms?.includes(device.value as 'mobile' | 'desktop')
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <device.icon className="w-6 h-6 mx-auto mb-2" />
                      <p className="font-medium text-sm">{device.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Placements */}
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4" />
                  Placements
                </Label>
                <div className="space-y-4">
                  {/* Facebook Placements */}
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="font-medium mb-3 flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-white text-xs">f</span>
                      Facebook
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PLACEMENTS.facebook.map((placement) => (
                        <button
                          key={placement.id}
                          onClick={() => {
                            const positions = formData.targeting.facebook_positions || [];
                            const newPositions = positions.includes(placement.id)
                              ? positions.filter(p => p !== placement.id)
                              : [...positions, placement.id];
                            updateTargeting({ facebook_positions: newPositions });
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-sm transition-colors",
                            formData.targeting.facebook_positions?.includes(placement.id)
                              ? "bg-blue-500 text-white"
                              : "bg-background hover:bg-muted"
                          )}
                        >
                          {placement.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Instagram Placements */}
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="font-medium mb-3 flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs">ig</span>
                      Instagram
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PLACEMENTS.instagram.map((placement) => (
                        <button
                          key={placement.id}
                          onClick={() => {
                            const positions = formData.targeting.instagram_positions || [];
                            const newPositions = positions.includes(placement.id)
                              ? positions.filter(p => p !== placement.id)
                              : [...positions, placement.id];
                            updateTargeting({ instagram_positions: newPositions });
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-sm transition-colors",
                            formData.targeting.instagram_positions?.includes(placement.id)
                              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                              : "bg-background hover:bg-muted"
                          )}
                        >
                          {placement.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              {/* CBO Notice */}
              {campaignUsesCBO && (
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">Campaign Budget Optimization Enabled</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        This campaign uses a campaign-level budget (${((selectedCampaign?.daily_budget || selectedCampaign?.lifetime_budget || 0) / 100).toFixed(2)}/day).
                        The budget will be automatically distributed across ad sets.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Campaign Bid Strategy Notice */}
              {campaignRequiresBidAmount && (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900 dark:text-amber-100">Bid Amount Required</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        This campaign uses <strong>{selectedCampaign?.bid_strategy?.replace(/_/g, ' ')}</strong> bid strategy.
                        You must provide a bid amount for this ad set.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Budget - only show if campaign doesn't use CBO */}
              {!campaignUsesCBO && (
                <>
                  <div>
                    <Label>Budget Type</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, budget_type: 'daily' }))}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all",
                          formData.budget_type === 'daily'
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <Calendar className="w-5 h-5 mb-2 text-primary" />
                        <p className="font-medium">Daily Budget</p>
                        <p className="text-xs text-muted-foreground">Spend up to this amount each day</p>
                      </button>
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, budget_type: 'lifetime' }))}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all",
                          formData.budget_type === 'lifetime'
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <DollarSign className="w-5 h-5 mb-2 text-primary" />
                        <p className="font-medium">Lifetime Budget</p>
                        <p className="text-xs text-muted-foreground">Spend over the ad set duration</p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="budget-amount">
                      {formData.budget_type === 'daily' ? 'Daily' : 'Lifetime'} Budget (USD)
                    </Label>
                    <div className="relative mt-2">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="budget-amount"
                        type="number"
                        value={formData.budget_amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, budget_amount: parseFloat(e.target.value) || 0 }))}
                        className="pl-10"
                        min={1}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Bid Strategy - Only show if campaign doesn't use CBO */}
              {!campaignUsesCBO && (
                <div>
                  <Label>Bid Strategy</Label>
                  <Select
                    value={formData.bid_strategy || 'LOWEST_COST_WITHOUT_CAP'}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      bid_strategy: value as BidStrategy,
                      // Clear bid_amount if switching to lowest cost
                      bid_amount: value === 'LOWEST_COST_WITHOUT_CAP' ? undefined : prev.bid_amount
                    }))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOWEST_COST_WITHOUT_CAP">Lowest Cost (Recommended)</SelectItem>
                      <SelectItem value="LOWEST_COST_WITH_BID_CAP">Bid Cap</SelectItem>
                      <SelectItem value="COST_CAP">Cost Cap</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.bid_strategy === 'LOWEST_COST_WITH_BID_CAP'
                      ? 'Set a maximum bid for each optimization event'
                      : formData.bid_strategy === 'COST_CAP'
                        ? 'Set an average cost target per optimization event'
                        : 'Get the most results at the lowest cost'}
                  </p>
                </div>
              )}

              {/* Show campaign bid strategy info when CBO is used */}
              {campaignUsesCBO && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Campaign Budget Optimization Active
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bid strategy is managed at campaign level: <strong>{selectedCampaign?.bid_strategy?.replace(/_/g, ' ') || 'Lowest Cost'}</strong>
                  </p>
                </div>
              )}

              {/* Bid Amount - show when campaign or ad set strategy requires it */}
              {(campaignRequiresBidAmount || (formData.bid_strategy && formData.bid_strategy !== 'LOWEST_COST_WITHOUT_CAP')) && (
                <div>
                  <Label htmlFor="bid-amount">
                    {(selectedCampaign?.bid_strategy === 'LOWEST_COST_WITH_BID_CAP' || formData.bid_strategy === 'LOWEST_COST_WITH_BID_CAP')
                      ? 'Bid Cap'
                      : 'Cost Cap'} (USD) <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative mt-2">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="bid-amount"
                      type="number"
                      value={formData.bid_amount || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, bid_amount: parseFloat(e.target.value) || undefined }))}
                      className="pl-10"
                      min={0.01}
                      step={0.01}
                      placeholder="e.g., 5.00"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.bid_strategy === 'LOWEST_COST_WITH_BID_CAP'
                      ? 'Maximum amount you\'ll pay per result'
                      : 'Average amount you want to pay per result'}
                  </p>
                </div>
              )}

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={formData.start_time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>End Date (Optional)</Label>
                  <Input
                    type="datetime-local"
                    value={formData.end_time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-muted/30">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </Button>
          <Button
            onClick={() => step < 4 ? setStep(step + 1) : onSubmit()}
            disabled={
              isSubmitting ||
              (step === 1 && (!formData.name || !formData.campaign_id)) ||
              (step === 4 && (
                // Require bid_amount if campaign's bid_strategy needs it
                (campaignRequiresBidAmount && !formData.bid_amount) ||
                // Or if ad set's bid_strategy needs it
                (formData.bid_strategy &&
                  formData.bid_strategy !== 'LOWEST_COST_WITHOUT_CAP' &&
                  !formData.bid_amount)
              ))
            }
            className="gap-2"
          >
            {step < 4 ? (
              <>
                Continue
                <ChevronRight className="w-4 h-4" />
              </>
            ) : isSubmitting ? 'Creating...' : 'Create Ad Set'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
