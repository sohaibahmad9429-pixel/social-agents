'use client';

import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
  Edit,
  Copy,
  TrendingUp,
  TrendingDown,
  Megaphone,
  ChevronDown,
  ChevronRight,
  Calendar,
  DollarSign,
  Eye,
  MousePointerClick,
  X,
  Target,
  Image,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type {
  Campaign,
  CampaignFormData,
  CampaignObjective,
  CampaignStatus,
  BidStrategy,
  SpecialAdCategory,
  CAMPAIGN_OBJECTIVES,
  BID_STRATEGIES,
} from '@/types/metaAds';

interface CampaignManagerProps {
  campaigns: Campaign[];
  adSets?: any[];
  ads?: any[];
  onRefresh: () => void;
  showCreate?: boolean;
  onShowCreateChange?: (show: boolean) => void;
  onCreateAdSet?: (campaignId: string) => void;
  onCreateAd?: (adSetId: string) => void;
}

// Meta Marketing API v24.0 - Campaign Objectives (ODAX)
const OBJECTIVES = [
  { value: 'OUTCOME_AWARENESS', label: 'Awareness', description: 'Maximize reach and ad recall - includes video views and brand awareness', icon: '👁️' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic', description: 'Drive traffic to website, app, or Instagram profile (v24.0)', icon: '🔗' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement', description: 'Get messages, video views, post engagement, Page likes, event responses', icon: '💬' },
  { value: 'OUTCOME_LEADS', label: 'Leads', description: 'Collect leads via forms, calls, or messaging - includes Quality Leads (v24.0)', icon: '📋' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion', description: 'Drive app installs and in-app events', icon: '📱' },
  { value: 'OUTCOME_SALES', label: 'Sales', description: 'Find buyers - supports ONSITE_CONVERSIONS and Value optimization (v24.0)', icon: '🛒' },
];

const initialFormData: CampaignFormData = {
  name: '',
  objective: 'OUTCOME_TRAFFIC',
  status: 'PAUSED',
  buying_type: 'AUCTION',
  budget_type: 'daily',
  budget_amount: 20,
  special_ad_categories: [],
  is_campaign_budget_optimization: true,
};

export default function CampaignManager({ campaigns = [], adSets = [], ads = [], onRefresh, showCreate, onShowCreateChange, onCreateAdSet, onCreateAd }: CampaignManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Sync with external showCreate prop
  React.useEffect(() => {
    if (showCreate !== undefined) {
      setShowCreateModal(showCreate);
    }
  }, [showCreate]);

  const handleModalChange = (show: boolean) => {
    setShowCreateModal(show);
    onShowCreateChange?.(show);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formData, setFormData] = useState<CampaignFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // If a campaign is selected, show its detail view
  if (selectedCampaign) {
    const campaignAdSets = adSets.filter(as => as.campaign_id === selectedCampaign.id);
    const campaignAds = ads.filter(ad => campaignAdSets.some(as => as.id === ad.adset_id));

    return (
      <CampaignDetailView
        campaign={selectedCampaign}
        adSets={campaignAdSets}
        ads={campaignAds}
        onBack={() => setSelectedCampaign(null)}
        onRefresh={onRefresh}
        onCreateAdSet={onCreateAdSet}
        onCreateAd={onCreateAd}
      />
    );
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateCampaign = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/meta-ads/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        handleModalChange(false);
        setFormData(initialFormData);
        onRefresh();
      }
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (campaignId: string, newStatus: CampaignStatus) => {
    try {
      await fetch(`/api/meta-ads/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      onRefresh();
    } catch (error) {
    }
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      buying_type: campaign.buying_type || 'AUCTION',
      budget_type: campaign.daily_budget ? 'daily' : 'lifetime',
      budget_amount: campaign.daily_budget ? campaign.daily_budget / 100 : campaign.lifetime_budget ? campaign.lifetime_budget / 100 : 20,
      special_ad_categories: campaign.special_ad_categories || [],
      is_campaign_budget_optimization: campaign.is_campaign_budget_optimization ?? true,
    });
    setShowEditModal(true);
  };

  const handleUpdateCampaign = async () => {
    if (!editingCampaign) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/meta-ads/campaigns/${editingCampaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditingCampaign(null);
        setFormData(initialFormData);
        onRefresh();
      }
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateCampaign = async (campaign: Campaign) => {
    try {
      const response = await fetch('/api/meta-ads/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${campaign.name} (Copy)`,
          objective: campaign.objective,
          status: 'PAUSED',
          buying_type: campaign.buying_type || 'AUCTION',
          budget_type: campaign.daily_budget ? 'daily' : 'lifetime',
          budget_amount: campaign.daily_budget ? campaign.daily_budget / 100 : campaign.lifetime_budget ? campaign.lifetime_budget / 100 : 20,
          special_ad_categories: campaign.special_ad_categories || [],
          is_campaign_budget_optimization: campaign.is_campaign_budget_optimization ?? true,
        }),
      });

      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
    }
  };

  const handleDeleteCampaign = async (campaign: Campaign) => {
    if (!confirm(`Are you sure you want to delete "${campaign.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await fetch(`/api/meta-ads/campaigns/${campaign.id}`, {
        method: 'DELETE',
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
          <h2 className="text-2xl font-bold">Campaigns</h2>
          <p className="text-muted-foreground">Manage your advertising campaigns</p>
        </div>
        <Button
          onClick={() => handleModalChange(true)}
          className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
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

      {/* Campaigns Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Budget</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Spend</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Impressions</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Clicks</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">CTR</th>
                  <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.length > 0 ? (
                  filteredCampaigns.map((campaign) => (
                    <CampaignRow
                      key={campaign.id}
                      campaign={campaign}
                      adSets={adSets.filter(as => as.campaign_id === campaign.id)}
                      ads={ads}
                      onSelect={() => setSelectedCampaign(campaign)}
                      onStatusChange={handleStatusChange}
                      onEdit={handleEditCampaign}
                      onDuplicate={handleDuplicateCampaign}
                      onDelete={handleDeleteCampaign}
                      onCreateAdSet={onCreateAdSet}
                      onCreateAd={onCreateAd}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="p-4 rounded-full bg-muted mb-4">
                          <Megaphone className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold mb-1">No campaigns found</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {searchQuery ? 'Try adjusting your search' : 'Create your first campaign to get started'}
                        </p>
                        <Button onClick={() => handleModalChange(true)} className="gap-2">
                          <Plus className="w-4 h-4" />
                          Create Campaign
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <CreateCampaignModal
          formData={formData}
          setFormData={setFormData}
          onClose={() => {
            handleModalChange(false);
            setFormData(initialFormData);
          }}
          onSubmit={handleCreateCampaign}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Edit Campaign Modal */}
      {showEditModal && editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          formData={formData}
          setFormData={setFormData}
          onClose={() => {
            setShowEditModal(false);
            setEditingCampaign(null);
            setFormData(initialFormData);
          }}
          onSubmit={handleUpdateCampaign}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}

function CampaignRow({
  campaign,
  adSets,
  ads,
  onSelect,
  onStatusChange,
  onEdit,
  onDuplicate,
  onDelete,
  onCreateAdSet,
  onCreateAd,
}: {
  campaign: Campaign;
  adSets: any[];
  ads: any[];
  onSelect: () => void;
  onStatusChange: (id: string, status: CampaignStatus) => void;
  onEdit: (campaign: Campaign) => void;
  onDuplicate: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
  onCreateAdSet?: (campaignId: string) => void;
  onCreateAd?: (adSetId: string) => void;
}) {

  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PAUSED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    DELETED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    ARCHIVED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };

  const ctr = campaign.insights?.impressions
    ? ((campaign.insights.clicks / campaign.insights.impressions) * 100).toFixed(2)
    : '0.00';

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      <td className="p-4">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={onSelect}
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium group-hover:text-primary transition-colors">{campaign.name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {campaign.objective.replace('OUTCOME_', '')}
              <span
                className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
              >
                {adSets.length} Ad Set{adSets.length !== 1 ? 's' : ''} →
              </span>
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </td>
      <td className="p-4">
        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", statusColors[campaign.status])}>
          {campaign.status}
        </span>
      </td>
      <td className="p-4 text-right">
        <span className="font-medium">
          ${campaign.daily_budget ? (campaign.daily_budget / 100).toFixed(2) : '0.00'}
        </span>
        <span className="text-xs text-muted-foreground">/day</span>
      </td>
      <td className="p-4 text-right font-medium">
        ${(campaign.insights?.spend || 0).toFixed(2)}
      </td>
      <td className="p-4 text-right font-medium">
        {formatNumber(campaign.insights?.impressions || 0)}
      </td>
      <td className="p-4 text-right font-medium">
        {formatNumber(campaign.insights?.clicks || 0)}
      </td>
      <td className="p-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <span className="font-medium">{ctr}%</span>
          {parseFloat(ctr) > 2 ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center justify-center gap-1">
          {campaign.status === 'ACTIVE' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onStatusChange(campaign.id, 'PAUSED')}
            >
              <Pause className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onStatusChange(campaign.id, 'ACTIVE')}
            >
              <Play className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(campaign)}
            title="Edit campaign"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onSelect}>
                <Layers className="w-4 h-4 mr-2" />
                View Ad Sets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateAdSet?.(campaign.id)}>
                <Target className="w-4 h-4 mr-2" />
                Add Ad Set
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(campaign)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Campaign
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(campaign)}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(campaign)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

// Campaign Detail View - shows all ad sets and ads for a single campaign
function CampaignDetailView({
  campaign,
  adSets,
  ads,
  onBack,
  onRefresh,
  onCreateAdSet,
  onCreateAd,
}: {
  campaign: Campaign;
  adSets: any[];
  ads: any[];
  onBack: () => void;
  onRefresh: () => void;
  onCreateAdSet?: (campaignId: string) => void;
  onCreateAd?: (adSetId: string) => void;
}) {
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PAUSED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    DELETED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    ARCHIVED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };

  // Calculate campaign totals
  const totalSpend = adSets.reduce((sum, as) => sum + (as.insights?.spend || 0), 0) + (campaign.insights?.spend || 0);
  const totalImpressions = adSets.reduce((sum, as) => sum + (as.insights?.impressions || 0), 0) + (campaign.insights?.impressions || 0);
  const totalClicks = adSets.reduce((sum, as) => sum + (as.insights?.clicks || 0), 0) + (campaign.insights?.clicks || 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronRight className="w-5 h-5 rotate-180" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{campaign.name}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{campaign.objective.replace('OUTCOME_', '')}</span>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[campaign.status])}>
                  {campaign.status}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Button onClick={() => onCreateAdSet?.(campaign.id)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Ad Set
        </Button>
      </div>

      {/* Campaign Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Spend</p>
            <p className="text-2xl font-bold">${totalSpend.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Impressions</p>
            <p className="text-2xl font-bold">{formatNumber(totalImpressions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Clicks</p>
            <p className="text-2xl font-bold">{formatNumber(totalClicks)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">CTR</p>
            <p className="text-2xl font-bold">{ctr}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Ad Sets List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Ad Sets ({adSets.length})
              </CardTitle>
              <CardDescription>Manage ad sets within this campaign</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {adSets.length > 0 ? (
            <div className="space-y-4">
              {adSets.map((adSet) => {
                const adSetAds = ads.filter(a => a.adset_id === adSet.id);
                const adSetCtr = adSet.insights?.impressions
                  ? ((adSet.insights.clicks / adSet.insights.impressions) * 100).toFixed(2)
                  : '0.00';

                return (
                  <div key={adSet.id} className="border rounded-lg">
                    {/* Ad Set Header */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white">
                          <Target className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{adSet.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {adSet.optimization_goal?.replace(/_/g, ' ')} • {adSetAds.length} Ad{adSetAds.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Budget</p>
                          <p className="font-medium">${(adSet.daily_budget || 0) / 100}/day</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Spend</p>
                          <p className="font-medium">${(adSet.insights?.spend || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Impressions</p>
                          <p className="font-medium">{formatNumber(adSet.insights?.impressions || 0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Clicks</p>
                          <p className="font-medium">{formatNumber(adSet.insights?.clicks || 0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">CTR</p>
                          <p className="font-medium">{adSetCtr}%</p>
                        </div>
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", statusColors[adSet.status] || statusColors.PAUSED)}>
                          {adSet.status}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateAd?.(adSet.id)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Ad
                        </Button>
                      </div>
                    </div>

                    {/* Ads within this Ad Set */}
                    {adSetAds.length > 0 && (
                      <div className="border-t bg-muted/20 p-4">
                        <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                          <Image className="w-3 h-3" />
                          Ads in this Ad Set
                        </p>
                        <div className="grid gap-2">
                          {adSetAds.map((ad) => (
                            <div
                              key={ad.id}
                              className="flex items-center justify-between p-3 rounded-md bg-background border"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                                  <Image className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{ad.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Created {new Date(ad.created_time).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">Spend</p>
                                  <p className="text-sm font-medium">${(ad.insights?.spend || 0).toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">Impressions</p>
                                  <p className="text-sm font-medium">{formatNumber(ad.insights?.impressions || 0)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">Clicks</p>
                                  <p className="text-sm font-medium">{formatNumber(ad.insights?.clicks || 0)}</p>
                                </div>
                                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[ad.status] || statusColors.PAUSED)}>
                                  {ad.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {adSetAds.length === 0 && (
                      <div className="border-t bg-muted/10 p-4 text-center">
                        <p className="text-sm text-muted-foreground">No ads yet</p>
                        <Button
                          size="sm"
                          variant="link"
                          onClick={() => onCreateAd?.(adSet.id)}
                        >
                          Create your first ad
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-1">No ad sets yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first ad set to start running ads
              </p>
              <Button onClick={() => onCreateAdSet?.(campaign.id)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Ad Set
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Ad Set Row Component (nested within Campaign - kept for reference but not used in detail view)
function AdSetRow({
  adSet,
  ads,
  onCreateAd
}: {
  adSet: any;
  ads: any[];
  onCreateAd?: (adSetId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PAUSED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    DELETED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    ARCHIVED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };

  return (
    <div className="border rounded-lg bg-background">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button className="p-1">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium text-sm">{adSet.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              {adSet.optimization_goal?.replace('_', ' ')}
              <span className="bg-muted px-1.5 py-0.5 rounded">
                {ads.length} Ad{ads.length !== 1 ? 's' : ''}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="font-medium">${(adSet.daily_budget || 0) / 100}/day</p>
          </div>
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[adSet.status] || statusColors.PAUSED)}>
            {adSet.status}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onCreateAd?.(adSet.id);
            }}
            className="h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Ad
          </Button>
        </div>
      </div>

      {/* Expanded Ads */}
      {isExpanded && (
        <div className="border-t p-3 pl-12 bg-muted/10">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Image className="w-3 h-3" />
              Ads in this Ad Set
            </h5>
          </div>

          {ads.length > 0 ? (
            <div className="space-y-1">
              {ads.map((ad) => (
                <div
                  key={ad.id}
                  className="flex items-center justify-between p-2 rounded-md bg-background border"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                      <Image className="w-3 h-3" />
                    </div>
                    <span className="text-sm font-medium">{ad.name}</span>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[ad.status] || statusColors.PAUSED)}>
                    {ad.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-xs">No ads yet</p>
              <Button
                size="sm"
                variant="link"
                onClick={() => onCreateAd?.(adSet.id)}
                className="text-xs h-6"
              >
                Create your first ad
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateCampaignModal({
  formData,
  setFormData,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  formData: CampaignFormData;
  setFormData: React.Dispatch<React.SetStateAction<CampaignFormData>>;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const [step, setStep] = useState(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Create Campaign</h2>
            <p className="text-sm text-muted-foreground">Step {step} of 3</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
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
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold mb-4 block">Campaign Objective</Label>
                <div className="grid grid-cols-2 gap-3">
                  {OBJECTIVES.map((obj) => (
                    <button
                      key={obj.value}
                      onClick={() => setFormData(prev => ({ ...prev, objective: obj.value as CampaignObjective }))}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left transition-all hover:border-primary/50",
                        formData.objective === obj.value
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      )}
                    >
                      <p className="font-medium">{obj.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{obj.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter campaign name"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Special Ad Categories</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Select if your ads are related to credit, employment, housing, or social issues
                </p>
                <div className="flex flex-wrap gap-2">
                  {['NONE', 'CREDIT', 'EMPLOYMENT', 'HOUSING', 'ISSUES_ELECTIONS_POLITICS'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        if (cat === 'NONE') {
                          setFormData(prev => ({ ...prev, special_ad_categories: [] }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            special_ad_categories: prev.special_ad_categories.includes(cat as SpecialAdCategory)
                              ? prev.special_ad_categories.filter(c => c !== cat)
                              : [...prev.special_ad_categories, cat as SpecialAdCategory]
                          }));
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        (cat === 'NONE' && formData.special_ad_categories.length === 0) ||
                          formData.special_ad_categories.includes(cat as SpecialAdCategory)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {cat === 'NONE' ? 'None' : cat.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                <div>
                  <p className="font-medium">Advantage Campaign Budget</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically distribute budget across ad sets
                  </p>
                </div>
                <button
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    is_campaign_budget_optimization: !prev.is_campaign_budget_optimization
                  }))}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    formData.is_campaign_budget_optimization ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                    formData.is_campaign_budget_optimization ? "translate-x-7" : "translate-x-1"
                  )} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
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
                    <p className="text-xs text-muted-foreground">Spend over the campaign duration</p>
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

              <div>
                <Label>Bid Strategy</Label>
                <Select
                  value={formData.bid_strategy || 'LOWEST_COST_WITHOUT_CAP'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, bid_strategy: value as BidStrategy }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOWEST_COST_WITHOUT_CAP">Lowest Cost (Recommended)</SelectItem>
                    <SelectItem value="LOWEST_COST_WITH_BID_CAP">Bid Cap</SelectItem>
                    <SelectItem value="COST_CAP">Cost Cap</SelectItem>
                    <SelectItem value="LOWEST_COST_WITH_MIN_ROAS">Minimum ROAS</SelectItem>
                  </SelectContent>
                </Select>
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
            onClick={() => step < 3 ? setStep(step + 1) : onSubmit()}
            disabled={isSubmitting || (step === 2 && !formData.name)}
            className="gap-2"
          >
            {step < 3 ? 'Continue' : isSubmitting ? 'Creating...' : 'Create Campaign'}
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

function EditCampaignModal({
  campaign,
  formData,
  setFormData,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  campaign: Campaign;
  formData: CampaignFormData;
  setFormData: React.Dispatch<React.SetStateAction<CampaignFormData>>;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Edit Campaign</h2>
            <p className="text-sm text-muted-foreground">{campaign.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Campaign Name */}
          <div>
            <Label htmlFor="edit-name">Campaign Name</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter campaign name"
              className="mt-2"
            />
          </div>

          {/* Status */}
          <div>
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as CampaignStatus }))}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Budget Type</Label>
              <Select
                value={formData.budget_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, budget_type: value as 'daily' | 'lifetime' }))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Budget</SelectItem>
                  <SelectItem value="lifetime">Lifetime Budget</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Budget Amount ($)</Label>
              <Input
                type="number"
                value={formData.budget_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, budget_amount: parseFloat(e.target.value) || 0 }))}
                min={1}
                className="mt-2"
              />
            </div>
          </div>

          {/* Campaign Budget Optimization */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Campaign Budget Optimization</p>
              <p className="text-sm text-muted-foreground">
                Automatically distribute budget across ad sets
              </p>
            </div>
            <Button
              variant={formData.is_campaign_budget_optimization ? "default" : "outline"}
              size="sm"
              onClick={() => setFormData(prev => ({
                ...prev,
                is_campaign_budget_optimization: !prev.is_campaign_budget_optimization
              }))}
            >
              {formData.is_campaign_budget_optimization ? 'On' : 'Off'}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || !formData.name}
            className="gap-2"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
