'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Sparkles,
  Info,
  AlertCircle,
  X,
  ChevronDown,
  Check,
  Upload,
  ImageIcon,
  FolderOpen,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { AI_MODELS, DEFAULT_AI_MODEL_ID, getModelDisplayName } from '@/constants/aiModels';
import {
  VEO_MODEL_OPTIONS,
  VEO_RESOLUTION_OPTIONS,
  VEO_DURATION_OPTIONS,
  VEO_ASPECT_RATIO_OPTIONS,
  type VeoModel,
  type VeoResolution,
  type VeoDuration,
  type VeoAspectRatio,
  type GeneratedVeoVideo,
  type GeneratedImage,
} from '../../types/mediaStudio.types';

// ============================================================================
// Types
// ============================================================================

interface LibraryImage {
  id: string;
  url: string;
  prompt?: string;
}

interface VeoFrameSpecificProps {
  onGenerationStarted: (video: GeneratedVeoVideo, historyAction: string) => void;
  onError: (error: string) => void;
  isGenerating: boolean;
  recentImages: GeneratedImage[];
  workspaceId?: string | null;
}

// ============================================================================
// Component
// ============================================================================

export function VeoFrameSpecific({
  onGenerationStarted,
  onError,
  isGenerating,
  recentImages,
  workspaceId,
}: VeoFrameSpecificProps) {
  // State
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<VeoModel>('veo-3.1-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<VeoAspectRatio>('16:9');
  const [duration, setDuration] = useState<VeoDuration>(8);
  const [resolution, setResolution] = useState<VeoResolution>('720p');
  const [firstFrameUrl, setFirstFrameUrl] = useState<string | null>(null);
  const [lastFrameUrl, setLastFrameUrl] = useState<string | null>(null);
  const [activeFrame, setActiveFrame] = useState<'first' | 'last' | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  // Prompt improvement state
  const [showImprovementModal, setShowImprovementModal] = useState(false);
  const [improvementInstructions, setImprovementInstructions] = useState('');
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [improvementError, setImprovementError] = useState<string | null>(null);
  const [selectedAIModelId, setSelectedAIModelId] = useState(DEFAULT_AI_MODEL_ID);
  const [showAIModelDropdown, setShowAIModelDropdown] = useState(false);

  const getUserFriendlyError = (error: unknown): string => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('API_KEY') || errorMessage.includes('401')) return 'API key not configured.';
    if (errorMessage.includes('429') || errorMessage.includes('rate') || errorMessage.includes('quota')) return 'Rate limit exceeded. Try a different model.';
    return 'Failed to improve prompt. Please try again.';
  };

  // Library state
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  const firstFrameInputRef = useRef<HTMLInputElement | null>(null);
  const lastFrameInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch library images
  const fetchLibraryImages = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoadingLibrary(true);
    try {
      const response = await fetch(`/api/media-studio/library?workspace_id=${workspaceId}&type=image&limit=20`);
      const data = await response.json();
      if (data.items) {
        setLibraryImages(data.items);
      }
    } catch (err) {
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [workspaceId]);

  // Load library when picker is opened
  useEffect(() => {
    if (showLibrary) {
      fetchLibraryImages();
    }
  }, [showLibrary, fetchLibraryImages]);

  // Validation: 1080p only available for 8s duration
  const is1080pDisabled = duration !== 8;

  React.useEffect(() => {
    if (resolution === '1080p' && duration !== 8) {
      setResolution('720p');
    }
  }, [duration, resolution]);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, frame: 'first' | 'last') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      onError('Please upload a JPEG, PNG, or WebP image');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      onError('Image must be under 20MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      if (frame === 'first') {
        setFirstFrameUrl(url);
      } else {
        setLastFrameUrl(url);
      }
    };
    reader.readAsDataURL(file);
  }, [onError]);

  // Handle library image selection
  const handleSelectLibraryImage = useCallback((url: string) => {
    if (activeFrame === 'first') {
      setFirstFrameUrl(url);
    } else if (activeFrame === 'last') {
      setLastFrameUrl(url);
    }
    setShowLibrary(false);
    setActiveFrame(null);
  }, [activeFrame]);

  // Open library for specific frame
  const openLibraryFor = useCallback((frame: 'first' | 'last') => {
    setActiveFrame(frame);
    setShowLibrary(true);
  }, []);

  // Handle improve prompt click
  const handleImprovePrompt = () => {
    if (!prompt.trim()) {
      setImprovementError('Please enter a prompt first');
      setTimeout(() => setImprovementError(null), 3000);
      return;
    }
    setShowImprovementModal(true);
    setImprovementError(null);
  };

  // Submit improvement request
  const handleSubmitImprovement = async () => {
    if (!prompt.trim()) return;

    setIsImprovingPrompt(true);
    setImprovementError(null);
    setShowImprovementModal(false);

    try {
      const response = await fetch('/api/ai/media/prompt/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPrompt: prompt,
          mediaType: 'video-generation',
          mediaSubType: 'frame-specific',
          provider: 'google',
          model: model,
          userInstructions: improvementInstructions || undefined,
          modelId: selectedAIModelId,
          context: {
            aspectRatio: aspectRatio,
            duration: duration,
            resolution: resolution,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to improve prompt');
      }

      // Update prompt with improved version
      setPrompt(data.improvedPrompt);
      setImprovementInstructions('');

    } catch (error) {
      console.error('Prompt improvement error:', error);
      setImprovementError(getUserFriendlyError(error));
      setTimeout(() => setImprovementError(null), 5000);
    } finally {
      setIsImprovingPrompt(false);
    }
  };

  // Handle generation
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      onError('Please enter a prompt describing the transition');
      return;
    }

    if (!firstFrameUrl) {
      onError('Please upload or select a first frame image');
      return;
    }

    if (!lastFrameUrl) {
      onError('Please upload or select a last frame image');
      return;
    }

    try {
      const response = await fetch('/api/ai/media/veo/frame-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstImageUrl: firstFrameUrl,
          lastImageUrl: lastFrameUrl,
          prompt: prompt.trim(),
          model,
          aspectRatio,
          durationSeconds: duration,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start video generation');
      }

      const video: GeneratedVeoVideo = {
        id: data.operationId,
        prompt: prompt.trim(),
        config: {
          prompt: prompt.trim(),
          model,
          aspectRatio,
          duration,
          resolution,
          generation_mode: 'frame-specific',
          first_frame_url: firstFrameUrl,
          last_frame_url: lastFrameUrl,
        },
        status: 'pending',
        progress: 0,
        createdAt: Date.now(),
        hasAudio: true,
        operationId: data.operationId,
        operationName: data.operationName,
        extensionCount: 0,
        isExtendable: true,
        thumbnailUrl: firstFrameUrl,
      };

      onGenerationStarted(video, 'veo-frame-specific');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to generate video');
    }
  }, [prompt, firstFrameUrl, lastFrameUrl, model, aspectRatio, duration, resolution, onGenerationStarted, onError]);

  // Render frame upload box
  const renderFrameUpload = (
    frame: 'first' | 'last',
    url: string | null,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => (
    <div className="flex-1 space-y-2">
      <Label className="text-sm font-medium">
        {frame === 'first' ? 'First Frame' : 'Last Frame'}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => handleFileUpload(e, frame)}
        className="hidden"
        disabled={isGenerating}
      />
      {!url ? (
        <Button
          variant="outline"
          className="w-full aspect-video border-dashed flex items-center justify-center"
          onClick={() => openLibraryFor(frame)}
          disabled={isGenerating}
        >
          <Upload className="w-6 h-6 text-muted-foreground" />
        </Button>
      ) : (
        <div className="relative rounded-lg overflow-hidden aspect-video">
          <img
            src={url}
            alt={`${frame} frame`}
            className="w-full h-full object-cover"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 w-6 h-6"
            onClick={() => frame === 'first' ? setFirstFrameUrl(null) : setLastFrameUrl(null)}
            disabled={isGenerating}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 p-3 rounded-lg">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Frame-Specific Generation</p>
          <p className="mt-1">
            Veo will create a smooth transition between your first and last frame images.
            Both images should have matching aspect ratios for best results.
          </p>
        </div>
      </div>

      {/* Frame Upload Section */}
      <div className="flex items-center gap-3">
        {renderFrameUpload('first', firstFrameUrl, firstFrameInputRef)}
        <ArrowRight className="w-6 h-6 text-muted-foreground flex-shrink-0" />
        {renderFrameUpload('last', lastFrameUrl, lastFrameInputRef)}
      </div>

      {/* Library Modal */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-4 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">
                Select {activeFrame === 'first' ? 'First' : 'Last'} Frame
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchLibraryImages}
                  disabled={isLoadingLibrary}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingLibrary ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowLibrary(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : libraryImages.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {libraryImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => handleSelectLibraryImage(img.url)}
                    className="relative aspect-square rounded-lg overflow-hidden hover:ring-2 ring-purple-500 transition-all"
                  >
                    <img
                      src={img.url}
                      alt={img.prompt || 'Library image'}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : recentImages.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {recentImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => handleSelectLibraryImage(img.url)}
                    className="relative aspect-square rounded-lg overflow-hidden hover:ring-2 ring-purple-500 transition-all"
                  >
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No images in library yet</p>
                <p className="text-xs">Generate some images first</p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Prompt */}
      <div className="space-y-2">
        <Label htmlFor="prompt" className="text-sm font-medium">
          Transition Prompt
        </Label>
        <Textarea
          id="prompt"
          placeholder="Describe the transition between frames... E.g., A smooth camera zoom revealing the scene change"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          className="min-h-[80px] resize-none"
        />
        <div className="flex items-center justify-start gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImprovePrompt}
            disabled={isImprovingPrompt || !prompt.trim() || isGenerating}
            className="h-7 text-xs font-medium bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:from-purple-700 hover:to-pink-600 border-0"
          >
            {isImprovingPrompt ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                Improving...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 mr-1.5" />
                Improve Prompt
              </>
            )}
          </Button>
          {improvementError && (
            <span className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {improvementError}
            </span>
          )}
        </div>
      </div>

      {/* Model and Aspect Ratio */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Model</Label>
          <Select
            value={model}
            onValueChange={(v: string) => setModel(v as VeoModel)}
            disabled={isGenerating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VEO_MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Aspect Ratio</Label>
          <Select
            value={aspectRatio}
            onValueChange={(v: string) => setAspectRatio(v as VeoAspectRatio)}
            disabled={isGenerating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VEO_ASPECT_RATIO_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Duration and Resolution */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Duration</Label>
          <Select
            value={String(duration)}
            onValueChange={(v: string) => setDuration(Number(v) as VeoDuration)}
            disabled={isGenerating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VEO_DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Resolution</Label>
          <Select
            value={resolution}
            onValueChange={(v: string) => setResolution(v as VeoResolution)}
            disabled={isGenerating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VEO_RESOLUTION_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.value === '1080p' && is1080pDisabled}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim() || !firstFrameUrl || !lastFrameUrl}
        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Transition
          </>
        )}
      </Button>

      {/* AI Prompt Improvement Modal */}
      {showImprovementModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setShowImprovementModal(false)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-r from-purple-500/10 to-pink-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Improve Prompt with AI</h3>
                  <p className="text-xs text-muted-foreground">Enhance frame transition prompt</p>
                </div>
              </div>
              <button
                onClick={() => setShowImprovementModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  What would you like to improve? <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Textarea
                  value={improvementInstructions}
                  onChange={(e) => setImprovementInstructions(e.target.value)}
                  placeholder="Example: Add smooth transitions, describe frame changes, include camera work..."
                  rows={7}
                  className="resize-none min-h-[160px]"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Quick suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Product Transform', instruction: 'Create smooth transformation between frames: elegant morphing, lighting transitions, reveal moments. Good for unboxing or feature demos.' },
                    { label: 'Before/After', instruction: 'Animate before/after transformation with professional transitions: dissolve, wipe, or gradual change. Ideal for beauty or fashion.' },
                    { label: 'Camera Journey', instruction: 'Describe camera path between frames: dolly, arc rotation, crane, or zoom. Specify motion curve for elegant pacing.' },
                    { label: 'Lighting Evolution', instruction: 'Add lighting changes: sunrise to golden hour, studio to natural. Create mood progression throughout the transition.' },
                    { label: 'Action Sequence', instruction: 'Fill the gap with action: pose changes, product rotation, clothing transformation. Describe motion beat-by-beat.' },
                    { label: 'Seamless Loop', instruction: 'Make it loop seamlessly: movement flows from last frame back to first. Add cyclical motion for social media.' }
                  ].map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => setImprovementInstructions(prev => prev ? `${prev}\n\n${suggestion.instruction}` : suggestion.instruction)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Model Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">AI Model</label>
                <div className="relative inline-block">
                  <button type="button" onClick={() => setShowAIModelDropdown(!showAIModelDropdown)} className="px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 transition-colors bg-muted/50 text-foreground flex items-center gap-2 text-xs">
                    <span>{getModelDisplayName(selectedAIModelId)}</span>
                    <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showAIModelDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showAIModelDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto whitespace-nowrap">
                      {AI_MODELS.map((aiModel) => (
                        <button key={aiModel.id} type="button" onClick={() => { setSelectedAIModelId(aiModel.id); setShowAIModelDropdown(false); }} className={`w-full px-3 py-1.5 text-left hover:bg-muted transition-colors flex items-center gap-2 text-xs ${selectedAIModelId === aiModel.id ? 'bg-primary/10' : ''}`}>
                          <span className="text-foreground">{aiModel.name} <span className="text-muted-foreground">({aiModel.providerLabel})</span></span>
                          {selectedAIModelId === aiModel.id && <Check className="w-3 h-3 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  💡 <strong>Tip:</strong> Describe how to transition between your start and end frames. AI will add professional details.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-muted/30">
              <Button
                onClick={() => {
                  setShowImprovementModal(false);
                  setImprovementInstructions('');
                }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitImprovement}
                disabled={isImprovingPrompt}
                className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isImprovingPrompt ? 'Improving...' : 'Improve Prompt'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VeoFrameSpecific;

