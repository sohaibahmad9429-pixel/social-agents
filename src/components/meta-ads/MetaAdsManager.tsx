'use client';

import React, { useState, useEffect } from 'react';
import {
  Target,
  BarChart3,
  Users,
  Megaphone,
  Settings2,
  Plus,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Eye,
  MousePointerClick,
  AlertCircle,
  CheckCircle2,
  Facebook,
  Instagram,
  FileImage,
  Calendar,
  Building2,
  ChevronDown,
  Check,
  Loader2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Import sub-components
import CampaignManager from './CampaignManager';
import AdSetManager from './AdSetManager';
import AdCreativeManager from './AdCreativeManager';
import AudienceManager from './AudienceManager';
import AdsAnalytics from './AdsAnalytics';
import MetaAdsConnect from './MetaAdsConnect';
import AdDraftsManager from './AdDraftsManager';

import type { AdAccount, Campaign, AdSet, Ad, CustomAudience, MetaAdsState, DatePreset } from '@/types/metaAds';
import { DATE_PRESETS, formatCurrency, formatNumber, formatPercentage } from '@/types/metaAds';

const initialState: MetaAdsState = {
  adAccount: null,
  campaigns: [],
  adSets: [],
  ads: [],
  audiences: [],
  images: [],
  videos: [],
  loading: true,
  error: null,
  selectedCampaign: null,
  selectedAdSet: null,
  selectedAd: null,
  selectedItems: [],
  viewMode: 'campaigns',
  datePreset: 'last_7d',
};

export default function MetaAdsManager() {
  const { user } = useAuth();
  const [state, setState] = useState<MetaAdsState>(initialState);
  const [activeTab, setActiveTab] = useState('overview');
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [datePreset, setDatePreset] = useState<DatePreset>('last_7d');
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showCreateAdSet, setShowCreateAdSet] = useState(false);
  const [showCreateAd, setShowCreateAd] = useState(false);

  // For hierarchical workflow - store IDs for pre-selection
  const [preselectedCampaignId, setPreselectedCampaignId] = useState<string | null>(null);
  const [preselectedAdSetId, setPreselectedAdSetId] = useState<string | null>(null);

  // Business Portfolio state
  const [availableBusinesses, setAvailableBusinesses] = useState<any[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<any>(null);
  const [showBusinessSelector, setShowBusinessSelector] = useState(false);
  const [isSwitchingBusiness, setIsSwitchingBusiness] = useState(false);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
    fetchBusinesses();
  }, []);

  // Close business selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showBusinessSelector) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-business-selector]')) {
          setShowBusinessSelector(false);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showBusinessSelector]);

  // Fetch available businesses
  const fetchBusinesses = async () => {
    try {
      const response = await fetch('/api/meta-ads/switch-business');
      if (response.ok) {
        const data = await response.json();
        setAvailableBusinesses(data.availableBusinesses || []);
        setActiveBusiness(data.activeBusiness);
      }
    } catch (error) {
    }
  };

  // Switch business portfolio
  const handleSwitchBusiness = async (businessId: string, adAccountId?: string) => {
    setIsSwitchingBusiness(true);
    try {
      const response = await fetch('/api/meta-ads/switch-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, adAccountId }),
      });

      if (response.ok) {
        const data = await response.json();
        setActiveBusiness({
          id: data.business.id,
          name: data.business.name,
          adAccount: data.adAccount,
        });
        setShowBusinessSelector(false);
        // Reload dashboard data with new business
        await checkConnectionStatus();
        await loadDashboardData();
      }
    } catch (error) {
    } finally {
      setIsSwitchingBusiness(false);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/meta-ads/status');
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.isConnected);
        if (data.isConnected && data.adAccount) {
          setState(prev => ({ ...prev, adAccount: data.adAccount, loading: false }));
          loadDashboardData();
        } else {
          setState(prev => ({ ...prev, loading: false }));
        }
      } else {
        // Handle 401, 404, and other non-200 responses
        setIsConnected(false);
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      setIsConnected(false);
      setState(prev => ({ ...prev, loading: false, error: 'Failed to check connection status' }));
    }
  };

  const loadDashboardData = async () => {
    setIsRefreshing(true);
    try {
      const [campaignsRes, audiencesRes] = await Promise.all([
        fetch('/api/meta-ads/campaigns'),
        fetch('/api/meta-ads/audiences'),
      ]);

      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        setState(prev => ({
          ...prev,
          campaigns: campaignsData.campaigns || [],
          adSets: campaignsData.adSets || [],
          ads: campaignsData.ads || [],
        }));
      } else {
        const errorData = await campaignsRes.json().catch(() => ({}));
      }

      if (audiencesRes.ok) {
        const audiencesData = await audiencesRes.json();
        setState(prev => ({ ...prev, audiences: audiencesData.audiences || [] }));
      }
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnect = () => {
    setIsConnected(true);
    loadDashboardData();
  };

  // Calculate overview metrics
  const totalSpend = state.campaigns.reduce((sum, c) => sum + (c.insights?.spend || 0), 0);
  const totalImpressions = state.campaigns.reduce((sum, c) => sum + (c.insights?.impressions || 0), 0);
  const totalClicks = state.campaigns.reduce((sum, c) => sum + (c.insights?.clicks || 0), 0);
  const totalReach = state.campaigns.reduce((sum, c) => sum + (c.insights?.reach || 0), 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const activeCampaigns = state.campaigns.filter(c => c.status === 'ACTIVE').length;

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-primary" />
            </div>
          </div>
          <p className="text-muted-foreground font-medium">Loading Meta Ads Manager...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return <MetaAdsConnect onConnect={handleConnect} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Megaphone className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Meta Ads Manager</h1>
                <div className="flex items-center gap-1.5">
                  <Facebook className="w-3 h-3 text-blue-500" />
                  <Instagram className="w-3 h-3 text-pink-500" />

                  {/* Business Portfolio Selector */}
                  {availableBusinesses.length > 1 ? (
                    <div className="relative" data-business-selector>
                      <button
                        onClick={() => setShowBusinessSelector(!showBusinessSelector)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
                      >
                        <Building2 className="w-3 h-3" />
                        <span className="max-w-[150px] truncate">{activeBusiness?.name || 'Select Business'}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {showBusinessSelector && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-popover border rounded-lg shadow-lg z-50 p-2">
                          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Business Portfolios</p>
                          {availableBusinesses.map((business) => (
                            <button
                              key={business.id}
                              onClick={() => handleSwitchBusiness(business.id)}
                              disabled={isSwitchingBusiness}
                              className={cn(
                                "w-full flex items-center justify-between px-2 py-2 text-left text-sm rounded hover:bg-muted transition-colors",
                                business.id === activeBusiness?.id && "bg-muted"
                              )}
                            >
                              <div>
                                <p className="font-medium">{business.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {business.adAccounts?.length || 0} ad account(s)
                                </p>
                              </div>
                              {business.id === activeBusiness?.id ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : isSwitchingBusiness ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {activeBusiness?.name || state.adAccount?.name || 'Ad Account'}
                    </span>
                  )}

                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {activeBusiness?.adAccount?.name || state.adAccount?.name || 'Ad Account'}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{state.adAccount?.currency || 'USD'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Date Range Selector */}
              <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                <SelectTrigger className="w-[160px] h-9">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDashboardData}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setActiveTab('campaigns');
                  setShowCreateCampaign(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted p-1 h-auto">
              <TabsTrigger value="overview" className="gap-1.5 text-xs">
                <BarChart3 className="w-3.5 h-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
                <Megaphone className="w-3.5 h-3.5" />
                Campaigns
              </TabsTrigger>
              {/* Ad Sets and Ads are now managed within Campaigns hierarchically */}
              <TabsTrigger value="audiences" className="gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5" />
                Audiences
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5 text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="drafts" className="gap-1.5 text-xs">
                <FileImage className="w-3.5 h-3.5" />
                Library
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Spend"
                  value={`$${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={DollarSign}
                  trend="+12.5%"
                  trendUp={true}
                  color="green"
                />
                <MetricCard
                  title="Impressions"
                  value={formatNumber(totalImpressions)}
                  icon={Eye}
                  trend="+8.2%"
                  trendUp={true}
                  color="blue"
                />
                <MetricCard
                  title="Clicks"
                  value={formatNumber(totalClicks)}
                  icon={MousePointerClick}
                  trend="+15.3%"
                  trendUp={true}
                  color="purple"
                />
                <MetricCard
                  title="CTR"
                  value={`${avgCTR.toFixed(2)}%`}
                  icon={TrendingUp}
                  trend="+2.1%"
                  trendUp={true}
                  color="orange"
                />
              </div>

              {/* Campaign Status Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-primary" />
                      Campaign Performance
                    </CardTitle>
                    <CardDescription>Your top performing campaigns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {state.campaigns.length > 0 ? (
                      <div className="space-y-4">
                        {state.campaigns.slice(0, 5).map((campaign) => (
                          <CampaignRow key={campaign.id} campaign={campaign} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={Megaphone}
                        title="No campaigns yet"
                        description="Create your first campaign to start advertising"
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <QuickActionButton
                      icon={Megaphone}
                      label="Create Campaign"
                      description="Launch a new ad campaign"
                      onClick={() => setActiveTab('campaigns')}
                    />
                    <QuickActionButton
                      icon={Users}
                      label="Build Audience"
                      description="Create custom or lookalike audience"
                      onClick={() => setActiveTab('audiences')}
                    />
                    <QuickActionButton
                      icon={BarChart3}
                      label="View Reports"
                      description="Analyze your ad performance"
                      onClick={() => setActiveTab('analytics')}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Account Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-primary" />
                    Account Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatusItem
                      label="Active Campaigns"
                      value={activeCampaigns}
                      status="success"
                    />
                    <StatusItem
                      label="Ad Sets"
                      value={state.adSets.length}
                      status="success"
                    />
                    <StatusItem
                      label="Audiences"
                      value={state.audiences.length}
                      status="success"
                    />
                    <StatusItem
                      label="Account Health"
                      value="Good"
                      status="success"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Campaigns Tab */}
            <TabsContent value="campaigns">
              <CampaignManager
                campaigns={state.campaigns}
                adSets={state.adSets}
                ads={state.ads}
                onRefresh={loadDashboardData}
                showCreate={showCreateCampaign}
                onShowCreateChange={setShowCreateCampaign}
                onCreateAdSet={(campaignId) => {
                  setPreselectedCampaignId(campaignId);
                  setShowCreateAdSet(true);
                  // Stay on campaigns tab - modal will open
                }}
                onCreateAd={(adSetId) => {
                  setPreselectedAdSetId(adSetId);
                  setShowCreateAd(true);
                  // Stay on campaigns tab - modal will open
                }}
              />
            </TabsContent>

            {/* Audiences Tab */}
            <TabsContent value="audiences">
              <AudienceManager
                audiences={state.audiences}
                onRefresh={loadDashboardData}
              />
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <AdsAnalytics
                campaigns={state.campaigns}
                adSets={state.adSets}
                ads={state.ads}
              />
            </TabsContent>

            {/* Library Ads / Drafts Tab */}
            <TabsContent value="drafts">
              <AdDraftsManager onRefresh={loadDashboardData} />
            </TabsContent>
          </Tabs>

          {/* Ad Set Creation Modal - triggered from Campaigns view */}
          {showCreateAdSet && (
            <div className="fixed inset-0 z-50">
              <AdSetManager
                adSets={state.adSets}
                campaigns={state.campaigns}
                onRefresh={() => {
                  loadDashboardData();
                  setShowCreateAdSet(false);
                  setPreselectedCampaignId(null);
                }}
                showCreate={true}
                onShowCreateChange={(show) => {
                  setShowCreateAdSet(show);
                  if (!show) setPreselectedCampaignId(null);
                }}
                preselectedCampaignId={preselectedCampaignId || undefined}
              />
            </div>
          )}

          {/* Ad Creation Modal - triggered from Campaigns view */}
          {showCreateAd && (
            <div className="fixed inset-0 z-50">
              <AdCreativeManager
                ads={state.ads}
                adSets={state.adSets}
                onRefresh={() => {
                  loadDashboardData();
                  setShowCreateAd(false);
                  setPreselectedAdSetId(null);
                }}
                showCreate={true}
                onShowCreateChange={(show) => {
                  setShowCreateAd(show);
                  if (!show) setPreselectedAdSetId(null);
                }}
                preselectedAdSetId={preselectedAdSetId || undefined}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend: string;
  trendUp: boolean;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            trendUp ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
          )}>
            {trend}
          </span>
        </div>
        <p className="text-xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
      </CardContent>
    </Card>
  );
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const statusStyles = {
    ACTIVE: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    PAUSED: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    DELETED: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    ARCHIVED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
          <Megaphone className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{campaign.name}</p>
          <p className="text-xs text-muted-foreground">{campaign.objective.replace('OUTCOME_', '')}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium">${(campaign.insights?.spend || 0).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Spend</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium">{formatNumber(campaign.insights?.impressions || 0)}</p>
          <p className="text-xs text-muted-foreground">Impr.</p>
        </div>
        <span className={cn("px-2 py-0.5 rounded text-xs font-medium", statusStyles[campaign.status])}>
          {campaign.status}
        </span>
      </div>
    </div>
  );
}

function QuickActionButton({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
    >
      <div className="p-2 rounded-md bg-muted">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function StatusItem({
  label,
  value,
  status,
}: {
  label: string;
  value: string | number;
  status: 'success' | 'warning' | 'error';
}) {
  const statusIcons = {
    success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
  };

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
      {statusIcons[status]}
      <div>
        <p className="text-sm font-medium">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

