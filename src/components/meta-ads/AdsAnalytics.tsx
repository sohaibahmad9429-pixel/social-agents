'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  MousePointerClick,
  Users,
  Target,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Instagram,
  Zap,
  Heart,
  ShoppingCart,
  AlertCircle,
  Loader2,
  Activity,
  PieChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Campaign, AdSet, Ad, DatePreset, CampaignInsights } from '@/types/metaAds';

interface AdsAnalyticsProps {
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  onRefresh?: () => void;
}

// v24.0 Date presets with new options
const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7d', label: 'Last 7 Days' },
  { value: 'last_14d', label: 'Last 14 Days' },
  { value: 'last_30d', label: 'Last 30 Days' },
  { value: 'last_90d', label: 'Last 90 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'lifetime', label: 'Lifetime' },
];

// v24.0 Extended insights structure
interface ExtendedInsights extends CampaignInsights {
  instagram_profile_visits?: number;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  video_p25_watched_actions?: number;
  video_p50_watched_actions?: number;
  video_p75_watched_actions?: number;
  video_p100_watched_actions?: number;
}

interface AnalyticsData {
  insights: ExtendedInsights[];
  loading: boolean;
  error: string | null;
}

export default function AdsAnalytics({ campaigns = [], adSets = [], ads = [], onRefresh }: AdsAnalyticsProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('last_7d');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    insights: [],
    loading: false,
    error: null,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch insights from API - v24.0 with instagram_profile_visits
  const fetchInsights = useCallback(async () => {
    setAnalyticsData(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`/api/meta-ads/analytics?date_preset=${datePreset}&level=account`);
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData({
          insights: data.insights || [],
          loading: false,
          error: null,
        });
      } else {
        const error = await response.json();
        setAnalyticsData({
          insights: [],
          loading: false,
          error: error.detail || 'Failed to fetch insights',
        });
      }
    } catch {
      setAnalyticsData({
        insights: [],
        loading: false,
        error: 'Network error fetching insights',
      });
    }
  }, [datePreset]);

  // Fetch insights when date preset changes
  useEffect(() => {
    if (campaigns.length > 0) {
      fetchInsights();
    }
  }, [datePreset, fetchInsights, campaigns.length]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchInsights();
    onRefresh?.();
    setIsRefreshing(false);
  };

  // Calculate aggregate metrics from campaigns OR API insights
  const filteredCampaigns = selectedCampaign === 'all'
    ? campaigns
    : campaigns.filter(c => c.id === selectedCampaign);

  // Use API insights if available, otherwise use campaign data
  const apiInsight = analyticsData.insights[0];

  const totalSpend = apiInsight?.spend ?? filteredCampaigns.reduce((sum, c) => sum + (c.insights?.spend || 0), 0);
  const totalImpressions = apiInsight?.impressions ?? filteredCampaigns.reduce((sum, c) => sum + (c.insights?.impressions || 0), 0);
  const totalClicks = apiInsight?.clicks ?? filteredCampaigns.reduce((sum, c) => sum + (c.insights?.clicks || 0), 0);
  const totalReach = apiInsight?.reach ?? filteredCampaigns.reduce((sum, c) => sum + (c.insights?.reach || 0), 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const totalConversions = apiInsight?.conversions ?? filteredCampaigns.reduce((sum, c) => sum + (c.insights?.conversions || 0), 0);
  const frequency = apiInsight?.frequency ?? (totalReach > 0 ? totalImpressions / totalReach : 0);

  // v24.0 New metrics
  const instagramProfileVisits = apiInsight?.instagram_profile_visits ?? 0;
  const roas = apiInsight?.roas ?? (totalConversions > 0 && totalSpend > 0 ? (totalConversions * 50) / totalSpend : 0);
  const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;

  // Calculate trends (compare with previous period would come from API)
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Simulated previous period data (in production, fetch from API)
  const trends = {
    spend: 12.5,
    impressions: 8.2,
    clicks: 15.3,
    reach: 6.8,
    ctr: 2.1,
    cpc: -5.2,
    cpm: 3.4,
    conversions: 18.7,
    instagramVisits: 24.5,
    roas: 8.3,
    frequency: 1.2,
  };

  // Campaign performance ranking
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) =>
    (b.insights?.spend || 0) - (a.insights?.spend || 0)
  );

  // Ad Set performance ranking
  const sortedAdSets = [...adSets].sort((a, b) =>
    ((b.insights?.ctr || 0)) - ((a.insights?.ctr || 0))
  );

  // Top ads by CTR
  const sortedAds = [...ads].sort((a, b) =>
    ((b.insights?.ctr || 0)) - ((a.insights?.ctr || 0))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Analytics Dashboard
          </h2>
          <p className="text-muted-foreground">
            Meta Marketing API v24.0 - Comprehensive performance insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="w-[160px]">
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
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Button variant="outline" size="icon">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {analyticsData.error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/30">
          <CardContent className="py-3 flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{analyticsData.error}</span>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics - Primary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Spend"
          value={`$${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          trend={trends.spend}
          icon={DollarSign}
          color="green"
          loading={analyticsData.loading}
        />
        <MetricCard
          title="Impressions"
          value={formatNumber(totalImpressions)}
          trend={trends.impressions}
          icon={Eye}
          color="blue"
          loading={analyticsData.loading}
        />
        <MetricCard
          title="Clicks"
          value={formatNumber(totalClicks)}
          trend={trends.clicks}
          icon={MousePointerClick}
          color="purple"
          loading={analyticsData.loading}
        />
        <MetricCard
          title="Reach"
          value={formatNumber(totalReach)}
          trend={trends.reach}
          icon={Users}
          color="orange"
          loading={analyticsData.loading}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SecondaryMetricCard
          title="CTR"
          value={`${avgCTR.toFixed(2)}%`}
          trend={trends.ctr}
          description="Click-through rate"
        />
        <SecondaryMetricCard
          title="CPC"
          value={`$${avgCPC.toFixed(2)}`}
          trend={trends.cpc}
          description="Cost per click"
          invertTrend
        />
        <SecondaryMetricCard
          title="CPM"
          value={`$${avgCPM.toFixed(2)}`}
          trend={trends.cpm}
          description="Cost per 1,000 impressions"
        />
        <SecondaryMetricCard
          title="Frequency"
          value={frequency.toFixed(2)}
          trend={trends.frequency}
          description="Avg times ad shown per person"
        />
      </div>

      {/* v24.0 New Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-pink-500/10 to-purple-500/5 border-pink-200 dark:border-pink-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Instagram className="w-5 h-5 text-pink-600" />
              <span className={cn(
                "flex items-center gap-0.5 text-xs font-medium text-green-600"
              )}>
                <ArrowUpRight className="w-3 h-3" />
                {trends.instagramVisits}%
              </span>
            </div>
            <p className="text-xl font-bold">{formatNumber(instagramProfileVisits)}</p>
            <p className="text-xs text-muted-foreground">Instagram Profile Visits</p>
            <p className="text-[10px] text-pink-600 mt-1">v24.0 NEW</p>
          </CardContent>
        </Card>

        <SecondaryMetricCard
          title="Conversions"
          value={formatNumber(totalConversions)}
          trend={trends.conversions}
          description="Total conversions"
        />

        <SecondaryMetricCard
          title="Cost/Conversion"
          value={`$${costPerConversion.toFixed(2)}`}
          trend={-8.5}
          description="Cost per conversion"
          invertTrend
        />

        <SecondaryMetricCard
          title="ROAS"
          value={`${roas.toFixed(2)}x`}
          trend={trends.roas}
          description="Return on ad spend"
        />
      </div>

      {/* Performance Over Time Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Performance Over Time
          </CardTitle>
          <CardDescription>
            Daily performance metrics for {DATE_PRESETS.find(p => p.value === datePreset)?.label || datePreset}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent rounded-lg border border-dashed">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-primary/40 mb-2" />
              <p className="text-muted-foreground font-medium">Performance Chart</p>
              <p className="text-sm text-muted-foreground">
                {campaigns.length > 0
                  ? `Showing data for ${filteredCampaigns.length} campaign(s)`
                  : 'Connect your Meta account to see real data'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Campaign Performance</CardTitle>
              <CardDescription>Detailed breakdown by campaign</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-1">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Campaign</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Spend</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Impressions</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Clicks</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">CTR</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">CPC</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Conversions</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {sortedCampaigns.length > 0 ? (
                  sortedCampaigns.map((campaign) => {
                    const ctr = campaign.insights?.impressions
                      ? ((campaign.insights.clicks / campaign.insights.impressions) * 100).toFixed(2)
                      : '0.00';
                    const cpc = campaign.insights?.clicks
                      ? (campaign.insights.spend / campaign.insights.clicks).toFixed(2)
                      : '0.00';
                    const campaignRoas = campaign.insights?.roas?.toFixed(2) || '-';

                    return (
                      <tr key={campaign.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              campaign.status === 'ACTIVE' ? "bg-green-500" : "bg-yellow-500"
                            )} />
                            <span className="font-medium">{campaign.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            campaign.status === 'ACTIVE'
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          )}>
                            {campaign.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium">
                          ${(campaign.insights?.spend || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(campaign.insights?.impressions || 0)}
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(campaign.insights?.clicks || 0)}
                        </td>
                        <td className="p-3 text-right">{ctr}%</td>
                        <td className="p-3 text-right">${cpc}</td>
                        <td className="p-3 text-right">
                          {campaign.insights?.conversions || 0}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {campaignRoas}x
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No campaign data available
                    </td>
                  </tr>
                )}
              </tbody>
              {sortedCampaigns.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">${totalSpend.toFixed(2)}</td>
                    <td className="p-3 text-right">{formatNumber(totalImpressions)}</td>
                    <td className="p-3 text-right">{formatNumber(totalClicks)}</td>
                    <td className="p-3 text-right">{avgCTR.toFixed(2)}%</td>
                    <td className="p-3 text-right">${avgCPC.toFixed(2)}</td>
                    <td className="p-3 text-right">{totalConversions}</td>
                    <td className="p-3 text-right">{roas.toFixed(2)}x</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Ad Sets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Top Ad Sets
            </CardTitle>
            <CardDescription>By performance score</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedAdSets.length > 0 ? (
              <div className="space-y-3">
                {sortedAdSets.slice(0, 5).map((adSet, index) => (
                  <div
                    key={adSet.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
                        index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                          index === 1 ? "bg-gray-400/20 text-gray-500" :
                            index === 2 ? "bg-orange-500/20 text-orange-600" :
                              "bg-primary/10 text-primary"
                      )}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{adSet.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(adSet.insights?.impressions || 0)} impressions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${(adSet.insights?.spend || 0).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {((adSet.insights?.ctr || 0)).toFixed(2)}% CTR
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No ad set data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Ads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Top Performing Ads
            </CardTitle>
            <CardDescription>By click-through rate</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedAds.length > 0 ? (
              <div className="space-y-3">
                {sortedAds.slice(0, 5).map((ad, index) => (
                  <div
                    key={ad.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
                        index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                          index === 1 ? "bg-gray-400/20 text-gray-500" :
                            index === 2 ? "bg-orange-500/20 text-orange-600" :
                              "bg-primary/10 text-primary"
                      )}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{ad.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(ad.insights?.clicks || 0)} clicks
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{((ad.insights?.ctr || 0)).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">CTR</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No ad data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              Quick Stats
            </CardTitle>
            <CardDescription>Account overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Active Campaigns</span>
                </div>
                <span className="font-semibold">
                  {campaigns.filter(c => c.status === 'ACTIVE').length}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-500" />
                  <span className="text-sm">Active Ad Sets</span>
                </div>
                <span className="font-semibold">
                  {adSets.filter(a => a.status === 'ACTIVE').length}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Running Ads</span>
                </div>
                <span className="font-semibold">
                  {ads.filter(a => a.status === 'ACTIVE').length}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-orange-500" />
                  <span className="text-sm">Conversion Rate</span>
                </div>
                <span className="font-semibold">
                  {totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : '0.00'}%
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 dark:border-pink-900">
                <div className="flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-pink-500" />
                  <span className="text-sm">IG Profile Visits</span>
                </div>
                <span className="font-semibold text-pink-600">
                  {formatNumber(instagramProfileVisits)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


    </div>
  );
}

function MetricCard({
  title,
  value,
  trend,
  icon: Icon,
  color,
  loading = false,
}: {
  title: string;
  value: string;
  trend: number;
  icon: React.ElementType;
  color: 'green' | 'blue' | 'purple' | 'orange';
  loading?: boolean;
}) {
  const colorClasses = {
    green: 'from-green-500/10 to-green-500/5 text-green-600',
    blue: 'from-blue-500/10 to-blue-500/5 text-blue-600',
    purple: 'from-purple-500/10 to-purple-500/5 text-purple-600',
    orange: 'from-orange-500/10 to-orange-500/5 text-orange-600',
  };

  const isPositive = trend >= 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-xl bg-gradient-to-br", colorClasses[color])}>
            <Icon className="w-5 h-5" />
          </div>
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium",
            isPositive ? "text-green-600" : "text-red-600"
          )}>
            {isPositive ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </div>
        </div>
        {loading ? (
          <div className="animate-pulse">
            <div className="h-7 bg-muted rounded w-24 mb-1" />
            <div className="h-4 bg-muted rounded w-16" />
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SecondaryMetricCard({
  title,
  value,
  trend,
  description,
  invertTrend = false,
}: {
  title: string;
  value: string;
  trend: number;
  description: string;
  invertTrend?: boolean;
}) {
  const isPositive = trend >= 0;
  // For CPC and cost metrics, negative trend is good (lower cost)
  const isGood = invertTrend ? !isPositive : isPositive;

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            isGood ? "text-green-600" : "text-red-600"
          )}>
            {isPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </div>
        </div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}
