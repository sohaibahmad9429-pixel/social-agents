'use client';

import React, { useState } from 'react';
import {
  Plus,
  Search,
  Users,
  UserPlus,
  Globe,
  Upload,
  Target,
  Sparkles,
  X,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
  Database,
  Link,
  Smartphone,
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
import type { CustomAudience, AudienceSubtype, LookalikeSpec } from '@/types/metaAds';

interface AudienceManagerProps {
  audiences: CustomAudience[];
  onRefresh: () => void;
}

const AUDIENCE_SOURCES = [
  {
    id: 'website',
    label: 'Website',
    description: 'People who visited your website',
    icon: Globe,
    subtype: 'WEBSITE' as AudienceSubtype,
  },
  {
    id: 'customer_list',
    label: 'Customer List',
    description: 'Upload your customer data',
    icon: Upload,
    subtype: 'CUSTOM' as AudienceSubtype,
  },
  {
    id: 'app_activity',
    label: 'App Activity',
    description: 'People who used your app',
    icon: Smartphone,
    subtype: 'APP' as AudienceSubtype,
  },
  {
    id: 'engagement',
    label: 'Engagement',
    description: 'People who engaged with your content',
    icon: Target,
    subtype: 'ENGAGEMENT' as AudienceSubtype,
  },
  {
    id: 'video',
    label: 'Video',
    description: 'People who watched your videos',
    icon: Eye,
    subtype: 'VIDEO' as AudienceSubtype,
  },
];

export default function AudienceManager({ audiences, onRefresh }: AudienceManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'custom' | 'lookalike' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAudiences = audiences.filter(audience =>
    audience.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const customAudiences = filteredAudiences.filter(a => a.subtype !== 'LOOKALIKE');
  const lookalikeAudiences = filteredAudiences.filter(a => a.subtype === 'LOOKALIKE');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Audiences</h2>
          <p className="text-muted-foreground">Create and manage custom and lookalike audiences</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setCreateType('lookalike');
              setShowCreateModal(true);
            }}
            className="gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Lookalike Audience
          </Button>
          <Button
            onClick={() => {
              setCreateType('custom');
              setShowCreateModal(true);
            }}
            className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            <Plus className="w-4 h-4" />
            Custom Audience
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search audiences..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom Audiences */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Custom Audiences ({customAudiences.length})
        </h3>
        {customAudiences.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customAudiences.map((audience) => (
              <AudienceCard key={audience.id} audience={audience} onRefresh={onRefresh} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No custom audiences</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a custom audience to target specific groups of people
                </p>
                <Button
                  onClick={() => {
                    setCreateType('custom');
                    setShowCreateModal(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Custom Audience
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lookalike Audiences */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-purple-500" />
          Lookalike Audiences ({lookalikeAudiences.length})
        </h3>
        {lookalikeAudiences.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lookalikeAudiences.map((audience) => (
              <AudienceCard key={audience.id} audience={audience} onRefresh={onRefresh} isLookalike />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <UserPlus className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No lookalike audiences</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a lookalike audience to find people similar to your best customers
                </p>
                <Button
                  onClick={() => {
                    setCreateType('lookalike');
                    setShowCreateModal(true);
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Lookalike Audience
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && createType && (
        <CreateAudienceModal
          type={createType}
          existingAudiences={audiences}
          onClose={() => {
            setShowCreateModal(false);
            setCreateType(null);
          }}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function AudienceCard({
  audience,
  onRefresh,
  isLookalike = false,
}: {
  audience: CustomAudience;
  onRefresh: () => void;
  isLookalike?: boolean;
}) {
  const subtypeLabels: Record<string, string> = {
    CUSTOM: 'Customer List',
    WEBSITE: 'Website Visitors',
    APP: 'App Users',
    ENGAGEMENT: 'Engagement',
    VIDEO: 'Video Viewers',
    LOOKALIKE: 'Lookalike',
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center text-white",
              isLookalike
                ? "bg-gradient-to-br from-purple-500 to-pink-500"
                : "bg-gradient-to-br from-blue-500 to-cyan-500"
            )}>
              {isLookalike ? <UserPlus className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </div>
            <div>
              <CardTitle className="text-base">{audience.name}</CardTitle>
              <CardDescription className="text-xs">
                {subtypeLabels[audience.subtype] || audience.subtype}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {audience.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{audience.description}</p>
        )}

        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50">
          <div>
            <p className="text-2xl font-bold">
              {audience.approximate_count
                ? formatNumber(audience.approximate_count)
                : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Estimated Size</p>
          </div>
          {isLookalike && audience.lookalike_spec && (
            <div className="text-right">
              <p className="font-semibold">{(audience.lookalike_spec.ratio || 0.01) * 100}%</p>
              <p className="text-xs text-muted-foreground">Similarity</p>
            </div>
          )}
        </div>

        {audience.retention_days && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="w-4 h-4" />
            <span>Retention: {audience.retention_days} days</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1">
            <Eye className="w-3 h-3" />
            View
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <Edit className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateAudienceModal({
  type,
  existingAudiences,
  onClose,
  onRefresh,
}: {
  type: 'custom' | 'lookalike';
  existingAudiences: CustomAudience[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subtype: 'WEBSITE' as AudienceSubtype,
    retention_days: 30,
    // Lookalike specific - v24.0 mandatory lookalike_spec
    source_audience_id: '',
    country: 'US',
    ratio: 0.01,
    type: 'similarity' as 'similarity' | 'reach' | 'custom_ratio', // v24.0 mandatory from Jan 2026
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const endpoint = type === 'custom' ? '/api/meta-ads/audiences/custom' : '/api/meta-ads/audiences/lookalike';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onClose();
        onRefresh();
      }
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSteps = type === 'custom' ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">
              Create {type === 'custom' ? 'Custom' : 'Lookalike'} Audience
            </h2>
            <p className="text-sm text-muted-foreground">Step {step} of {totalSteps}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i + 1 <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[55vh]">
          {type === 'custom' ? (
            <>
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-base font-semibold mb-4 block">Choose Audience Source</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {AUDIENCE_SOURCES.map((source) => (
                        <button
                          key={source.id}
                          onClick={() => setFormData(prev => ({ ...prev, subtype: source.subtype }))}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all",
                            formData.subtype === source.subtype
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <source.icon className="w-6 h-6 mb-2 text-primary" />
                          <p className="font-medium">{source.label}</p>
                          <p className="text-xs text-muted-foreground">{source.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="audience-name">Audience Name</Label>
                    <Input
                      id="audience-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter audience name"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="audience-description">Description (Optional)</Label>
                    <Textarea
                      id="audience-description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe this audience"
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Retention Period</Label>
                    <Select
                      value={formData.retention_days.toString()}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, retention_days: parseInt(value) }))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="180">180 days</SelectItem>
                        <SelectItem value="365">365 days</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      How long people stay in this audience after meeting the criteria
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-base font-semibold mb-4 block">Select Source Audience</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Choose a custom audience to base your lookalike on
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {existingAudiences.filter(a => a.subtype !== 'LOOKALIKE').map((audience) => (
                        <button
                          key={audience.id}
                          onClick={() => setFormData(prev => ({ ...prev, source_audience_id: audience.id }))}
                          className={cn(
                            "w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3",
                            formData.source_audience_id === audience.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{audience.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {audience.approximate_count ? formatNumber(audience.approximate_count) : '-'} people
                            </p>
                          </div>
                        </button>
                      ))}
                      {existingAudiences.filter(a => a.subtype !== 'LOOKALIKE').length === 0 && (
                        <div className="text-center py-8">
                          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">No source audiences available</p>
                          <p className="text-sm text-muted-foreground">Create a custom audience first</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <Label>Target Country</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="DE">Germany</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Audience Size</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Smaller audiences are more similar to your source. Larger audiences have greater reach.
                    </p>
                    <div className="space-y-4">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={formData.ratio * 100}
                        onChange={(e) => setFormData(prev => ({ ...prev, ratio: parseInt(e.target.value) / 100 }))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">More Similar</span>
                        <span className="font-semibold">{formData.ratio * 100}%</span>
                        <span className="text-muted-foreground">Greater Reach</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="lookalike-name">Audience Name</Label>
                    <Input
                      id="lookalike-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter audience name"
                      className="mt-2"
                    />
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Source Audience</span>
                        <span className="font-medium">
                          {existingAudiences.find(a => a.id === formData.source_audience_id)?.name || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Target Country</span>
                        <span className="font-medium">{formData.country}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Audience Size</span>
                        <span className="font-medium">{formData.ratio * 100}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      <strong>Note:</strong> Lookalike audiences typically take 1-6 hours to populate.
                      You'll be able to use it in your campaigns once it's ready.
                    </p>
                  </div>
                </div>
              )}
            </>
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
            onClick={() => step < totalSteps ? setStep(step + 1) : handleSubmit()}
            disabled={
              isSubmitting ||
              (type === 'custom' && step === 2 && !formData.name) ||
              (type === 'lookalike' && step === 1 && !formData.source_audience_id) ||
              (type === 'lookalike' && step === 3 && !formData.name)
            }
            className="gap-2"
          >
            {step < totalSteps ? (
              <>
                Continue
                <ChevronRight className="w-4 h-4" />
              </>
            ) : isSubmitting ? 'Creating...' : 'Create Audience'}
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
