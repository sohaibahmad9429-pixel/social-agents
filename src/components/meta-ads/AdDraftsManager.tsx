'use client';

/**
 * Ad Library Manager
 * Displays ad creatives saved from the content library
 * Allows assigning drafts to existing campaigns or creating new ones
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Video,
  Layers,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  Plus,
  MoreHorizontal,
  ExternalLink,
  Calendar,
  Send,
  Search,
  Filter,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

// Types
interface AdDraft {
  id: string;
  workspace_id: string;
  platform: 'facebook' | 'instagram' | 'both';
  ad_type: 'single_image' | 'single_video' | 'carousel';
  status: 'draft' | 'pending' | 'published' | 'failed';
  creative: {
    headline: string;
    primary_text: string;
    call_to_action: string;
    destination_url: string;
    media_url: string;
    media_type: 'image' | 'video';
    additional_urls?: string[];
    ad_name?: string;
  };
  created_at: string;
  updated_at: string;
  meta_campaign_id?: string;
  meta_adset_id?: string;
  meta_ad_id?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
}

interface AdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
}

interface AdDraftsManagerProps {
  onRefresh?: () => void;
}

export default function AdDraftsManager({ onRefresh }: AdDraftsManagerProps) {
  const { workspaceId } = useAuth();

  // State
  const [drafts, setDrafts] = useState<AdDraft[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<AdDraft | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());

  // Assign to campaign state
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedAdSetId, setSelectedAdSetId] = useState<string>('');
  const [filteredAdSets, setFilteredAdSets] = useState<AdSet[]>([]);

  // Filtered drafts
  const filteredDrafts = useMemo(() => {
    return drafts.filter(draft => {
      const matchesSearch = !searchQuery ||
        draft.creative.headline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        draft.creative.primary_text?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || draft.status === statusFilter;
      const matchesType = typeFilter === 'all' || draft.ad_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [drafts, searchQuery, statusFilter, typeFilter]);

  // Load data
  useEffect(() => {
    if (workspaceId) {
      loadData();
    }
  }, [workspaceId]);

  // Filter ad sets when campaign changes
  useEffect(() => {
    if (selectedCampaignId) {
      setFilteredAdSets(adSets.filter(as => as.campaign_id === selectedCampaignId));
      setSelectedAdSetId('');
    } else {
      setFilteredAdSets([]);
    }
  }, [selectedCampaignId, adSets]);

  const loadData = async () => {
    if (!workspaceId) return;
    setIsLoading(true);

    try {
      // Load drafts, campaigns, and ad sets in parallel
      const [draftsRes, campaignsRes, adSetsRes] = await Promise.all([
        fetch(`/api/meta-ads/ads/draft?workspaceId=${workspaceId}`),
        fetch('/api/meta-ads/campaigns'),
        fetch('/api/meta-ads/adsets'),
      ]);

      if (draftsRes.ok) {
        const data = await draftsRes.json();
        setDrafts(data.drafts || []);
      }

      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        setCampaigns(data.campaigns || []);
      }

      if (adSetsRes.ok) {
        const data = await adSetsRes.json();
        setAdSets(data.adSets || []);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  // Delete draft
  const handleDelete = async (draftId: string) => {
    if (!confirm('Delete this ad from library?')) return;

    setActionLoading(draftId);
    try {
      const response = await fetch(`/api/meta-ads/ads/draft/${draftId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
        toast.success('Ad deleted');
      } else {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
      }
    } catch {
      setDrafts(prev => prev.filter(d => d.id !== draftId));
    } finally {
      setActionLoading(null);
    }
  };

  // Assign draft to campaign
  const handleAssign = async () => {
    if (!selectedDraft || !selectedCampaignId || !selectedAdSetId) {
      toast.error('Please select a campaign and ad set');
      return;
    }

    setActionLoading(selectedDraft.id);

    try {
      const response = await fetch('/api/meta-ads/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedDraft.creative.ad_name || selectedDraft.creative.headline,
          adset_id: selectedAdSetId,
          status: 'PAUSED',
          creative: {
            title: selectedDraft.creative.headline,
            body: selectedDraft.creative.primary_text,
            call_to_action_type: selectedDraft.creative.call_to_action,
            link_url: selectedDraft.creative.destination_url,
            image_url: selectedDraft.creative.media_type === 'image' ? selectedDraft.creative.media_url : undefined,
            video_url: selectedDraft.creative.media_type === 'video' ? selectedDraft.creative.media_url : undefined,
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update draft status
        await fetch(`/api/meta-ads/ads/draft/${selectedDraft.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'published',
            meta_campaign_id: selectedCampaignId,
            meta_adset_id: selectedAdSetId,
            meta_ad_id: data.ad?.id,
          }),
        });

        setDrafts(prev => prev.map(d =>
          d.id === selectedDraft.id
            ? { ...d, status: 'published' as const, meta_ad_id: data.ad?.id }
            : d
        ));

        toast.success('Ad added to campaign successfully');
        setIsAssignOpen(false);
        onRefresh?.();
      } else {
        toast.error(data.error || 'Failed to create ad');
      }
    } catch (error) {
      toast.error('Failed to add ad to campaign');
    } finally {
      setActionLoading(null);
      setSelectedCampaignId('');
      setSelectedAdSetId('');
    }
  };

  // Open assign dialog
  const openAssignDialog = (draft: AdDraft) => {
    setSelectedDraft(draft);
    setSelectedCampaignId('');
    setSelectedAdSetId('');
    setIsAssignOpen(true);
  };

  // Get media type icon
  const getMediaIcon = (draft: AdDraft) => {
    if (draft.ad_type === 'carousel') return <Layers className="w-4 h-4" />;
    if (draft.creative.media_type === 'video') return <Video className="w-4 h-4" />;
    return <ImageIcon className="w-4 h-4" />;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      published: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    return (
      <Badge className={`${styles[status] || styles.draft} font-medium`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Bulk delete
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedDrafts.size} selected ads?`)) return;
    for (const id of selectedDrafts) {
      await handleDelete(id);
    }
    setSelectedDrafts(new Set());
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedDrafts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all
  const selectAll = () => {
    if (selectedDrafts.size === filteredDrafts.length) {
      setSelectedDrafts(new Set());
    } else {
      setSelectedDrafts(new Set(filteredDrafts.map(d => d.id)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ad Library</h2>
          <p className="text-sm text-muted-foreground">
            {filteredDrafts.length} of {drafts.length} ad{drafts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedDrafts.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete ({selectedDrafts.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search ads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="single_image">Image</SelectItem>
            <SelectItem value="single_video">Video</SelectItem>
            <SelectItem value="carousel">Carousel</SelectItem>
          </SelectContent>
        </Select>
        {filteredDrafts.length > 0 && (
          <Button variant="ghost" size="sm" onClick={selectAll}>
            {selectedDrafts.size === filteredDrafts.length ? (
              <><CheckSquare className="w-4 h-4 mr-1" /> Deselect All</>
            ) : (
              <><Square className="w-4 h-4 mr-1" /> Select All</>
            )}
          </Button>
        )}
      </div>

      {/* Empty State */}
      {filteredDrafts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">
              {drafts.length === 0 ? 'No Ads in Library' : 'No Matching Ads'}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {drafts.length === 0
                ? 'Create ads from your media library using the "Send to Ad" button on any content.'
                : 'Try adjusting your filters to find what you\'re looking for.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Drafts Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDrafts.map((draft) => (
            <Card key={draft.id} className={`overflow-hidden group ${selectedDrafts.has(draft.id) ? 'ring-2 ring-primary' : ''}`}>
              {/* Selection checkbox overlay */}
              <div className="absolute top-2 left-2 z-10">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelection(draft.id); }}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${selectedDrafts.has(draft.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white/80 hover:bg-white'
                    }`}
                >
                  {selectedDrafts.has(draft.id) ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </div>
              {/* Media Preview */}
              <div className="relative aspect-square bg-muted">
                {draft.creative.media_type === 'video' ? (
                  <video
                    src={draft.creative.media_url}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={draft.creative.media_url}
                    alt={draft.creative.headline}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

                {/* Quick Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="secondary" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setSelectedDraft(draft);
                        setIsPreviewOpen(true);
                      }}>
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      {draft.status === 'draft' && (
                        <DropdownMenuItem onClick={() => openAssignDialog(draft)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add to Campaign
                        </DropdownMenuItem>
                      )}
                      {draft.creative.destination_url && (
                        <DropdownMenuItem asChild>
                          <a href={draft.creative.destination_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Visit URL
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDelete(draft.id)}
                        disabled={actionLoading === draft.id}
                      >
                        {actionLoading === draft.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Type Badge */}
                <div className="absolute bottom-2 left-2">
                  <Badge variant="secondary" className="gap-1 bg-white/90">
                    {getMediaIcon(draft)}
                    {draft.ad_type.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {/* Content */}
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-sm line-clamp-1">
                    {draft.creative.headline || 'Untitled'}
                  </h3>
                  {getStatusBadge(draft.status)}
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {draft.creative.primary_text || 'No description'}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(draft.created_at).toLocaleDateString()}
                  </span>

                  {draft.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => openAssignDialog(draft)}
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Assign
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ad Preview</DialogTitle>
            <DialogDescription>
              {selectedDraft?.creative.headline}
            </DialogDescription>
          </DialogHeader>

          {selectedDraft && (
            <div className="space-y-4">
              {/* Media */}
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                {selectedDraft.creative.media_type === 'video' ? (
                  <video
                    src={selectedDraft.creative.media_url}
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <img
                    src={selectedDraft.creative.media_url}
                    alt={selectedDraft.creative.headline}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Headline</Label>
                  <p className="font-medium">{selectedDraft.creative.headline}</p>
                </div>

                {selectedDraft.creative.primary_text && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Primary Text</Label>
                    <p className="text-sm">{selectedDraft.creative.primary_text}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Call to Action</Label>
                    <p className="text-sm">{selectedDraft.creative.call_to_action.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedDraft.status)}</div>
                  </div>
                </div>

                {selectedDraft.creative.destination_url && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Destination URL</Label>
                    <a
                      href={selectedDraft.creative.destination_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {selectedDraft.creative.destination_url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close
            </Button>
            {selectedDraft?.status === 'draft' && (
              <Button onClick={() => {
                setIsPreviewOpen(false);
                openAssignDialog(selectedDraft);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Add to Campaign
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to Campaign Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Campaign</DialogTitle>
            <DialogDescription>
              Select an existing campaign and ad set to publish this ad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Campaign Selection */}
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No campaigns available
                    </SelectItem>
                  ) : (
                    campaigns.map(campaign => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Ad Set Selection */}
            <div className="space-y-2">
              <Label>Ad Set</Label>
              <Select
                value={selectedAdSetId}
                onValueChange={setSelectedAdSetId}
                disabled={!selectedCampaignId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedCampaignId
                      ? "Select a campaign first"
                      : "Select an ad set"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {filteredAdSets.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No ad sets in this campaign
                    </SelectItem>
                  ) : (
                    filteredAdSets.map(adSet => (
                      <SelectItem key={adSet.id} value={adSet.id}>
                        {adSet.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedCampaignId && filteredAdSets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Create an ad set in this campaign first via Ads Manager.
                </p>
              )}
            </div>

            {/* Selected Ad Info */}
            {selectedDraft && (
              <div className="p-3 bg-muted rounded-lg flex gap-3">
                <div className="w-16 h-16 rounded bg-background overflow-hidden flex-shrink-0">
                  {selectedDraft.creative.media_type === 'video' ? (
                    <video
                      src={selectedDraft.creative.media_url}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={selectedDraft.creative.media_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{selectedDraft.creative.headline}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedDraft.creative.primary_text}</p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {selectedDraft.creative.call_to_action.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedCampaignId || !selectedAdSetId || actionLoading !== null}
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Add to Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
