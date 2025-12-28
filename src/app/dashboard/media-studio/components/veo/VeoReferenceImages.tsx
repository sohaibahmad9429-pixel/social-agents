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
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Sparkles,
  Info,
  Upload,
  ImageIcon,
  X,
  FolderOpen,
  Plus,
  Lock,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronDown,
  Check
} from 'lucide-react';
import { AI_MODELS, DEFAULT_AI_MODEL_ID, getModelDisplayName } from '@/constants/aiModels';
import {
  VEO_MODEL_OPTIONS,
  VEO_RESOLUTION_OPTIONS,
  VEO_ASPECT_RATIO_OPTIONS,
  VEO_MAX_REFERENCE_IMAGES,
  type VeoModel,
  type VeoResolution,
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

interface VeoReferenceImagesProps {
  onGenerationStarted: (video: GeneratedVeoVideo, historyAction: string) => void;
  onError: (error: string) => void;
  isGenerating: boolean;
  recentImages: GeneratedImage[];
  workspaceId?: string | null;
}

// ============================================================================
// Component
// ============================================================================

export function VeoReferenceImages({
  onGenerationStarted,
  onError,
  isGenerating,
  recentImages,
  workspaceId,
}: VeoReferenceImagesProps) {
  // State
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<VeoModel>('veo-3.1-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<VeoAspectRatio>('16:9');
  const [resolution, setResolution] = useState<VeoResolution>('720p');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Duration is fixed to 8s for reference images
  const duration = 8;

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (referenceImages.length >= VEO_MAX_REFERENCE_IMAGES) {
      onError(`Maximum ${VEO_MAX_REFERENCE_IMAGES} reference images allowed`);
      return;
    }

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
      setReferenceImages(prev => [...prev, url]);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [referenceImages.length, onError]);

  // Handle library image selection
  const handleSelectLibraryImage = useCallback((url: string) => {
    if (referenceImages.length >= VEO_MAX_REFERENCE_IMAGES) {
      onError(`Maximum ${VEO_MAX_REFERENCE_IMAGES} reference images allowed`);
      return;
    }
    setReferenceImages(prev => [...prev, url]);
    setShowLibrary(false);
  }, [referenceImages.length, onError]);

  // Remove image
  const handleRemoveImage = useCallback((index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
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
          mediaSubType: 'reference',
          provider: 'google',
          model: model,
          userInstructions: improvementInstructions || undefined,
          modelId: selectedAIModelId,
          context: {
            aspectRatio: aspectRatio,
            resolution: resolution,
            referenceImageCount: referenceImages.length,
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
      onError('Please enter a prompt describing the video');
      return;
    }

    if (referenceImages.length === 0) {
      onError('Please add at least 1 reference image');
      return;
    }

    try {
      const response = await fetch('/api/ai/media/veo/reference-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          aspectRatio,
          referenceImages: referenceImages.map(url => ({
            imageUrl: url,
            referenceType: 'asset',
          })),
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
          duration: 8, // Fixed
          resolution,
          generation_mode: 'reference',
          reference_image_urls: referenceImages,
        },
        status: 'pending',
        progress: 0,
        createdAt: Date.now(),
        hasAudio: true,
        operationId: data.operationId,
        operationName: data.operationName,
        extensionCount: 0,
        isExtendable: true,
        thumbnailUrl: referenceImages[0],
      };

      onGenerationStarted(video, 'veo-reference');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to generate video');
    }
  }, [prompt, referenceImages, model, aspectRatio, resolution, onGenerationStarted, onError]);

  const canAddMore = referenceImages.length < VEO_MAX_REFERENCE_IMAGES;

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 p-3 rounded-lg">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Reference Image Generation</p>
          <p className="mt-1">
            Use 1-3 images to guide style, characters, or scene elements. Duration is fixed to 8 seconds.
          </p>
        </div>
      </div>

      {/* Reference Images Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Reference Images
            <span className="text-muted-foreground ml-1 font-normal">
              ({referenceImages.length}/{VEO_MAX_REFERENCE_IMAGES})
            </span>
          </Label>
          {referenceImages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReferenceImages([])}
              disabled={isGenerating}
              className="text-xs text-muted-foreground"
            >
              Clear all
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isGenerating || !canAddMore}
        />

        <div className="grid grid-cols-3 gap-2">
          {/* Existing images */}
          {referenceImages.map((url, index) => (
            <div key={index} className="relative rounded-lg overflow-hidden aspect-square">
              <img
                src={url}
                alt={`Reference ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 w-6 h-6"
                onClick={() => handleRemoveImage(index)}
                disabled={isGenerating}
              >
                <X className="w-3 h-3" />
              </Button>
              <Badge
                className="absolute bottom-1 left-1 text-[10px]"
                variant="secondary"
              >
                {index === 0 ? 'Primary' : `Ref ${index + 1}`}
              </Badge>
            </div>
          ))}

          {/* Add more slots */}
          {canAddMore && (
            <Button
              variant="outline"
              className="aspect-square border-dashed flex items-center justify-center"
              onClick={() => setShowLibrary(true)}
              disabled={isGenerating}
            >
              <Upload className="w-5 h-5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Library Modal */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-4 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Select Reference Image ({referenceImages.length}/{VEO_MAX_REFERENCE_IMAGES})</h3>
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
                    disabled={referenceImages.length >= VEO_MAX_REFERENCE_IMAGES}
                    className={`relative aspect-square rounded-lg overflow-hidden transition-all ${referenceImages.length >= VEO_MAX_REFERENCE_IMAGES
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:ring-2 ring-purple-500'
                      }`}
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
                    disabled={referenceImages.length >= VEO_MAX_REFERENCE_IMAGES}
                    className={`relative aspect-square rounded-lg overflow-hidden transition-all ${referenceImages.length >= VEO_MAX_REFERENCE_IMAGES
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:ring-2 ring-purple-500'
                      }`}
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
          Video Prompt
        </Label>
        <Textarea
          id="prompt"
          placeholder="Describe the video using your reference images... E.g., A character from reference image 1 walking through the landscape from reference image 2"
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

      {/* Duration (locked) and Resolution */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1">
            Duration
            <Lock className="w-3 h-3 text-muted-foreground" />
          </Label>
          <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/50 flex items-center text-sm text-muted-foreground">
            8 seconds (fixed)
          </div>
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
                <SelectItem key={opt.value} value={opt.value}>
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
        disabled={isGenerating || !prompt.trim() || referenceImages.length === 0}
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
            Generate Video
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
                  <p className="text-xs text-muted-foreground">Enhance reference-based video prompt</p>
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
                  placeholder="Example: Reference images better, add motion details, describe scene flow..."
                  rows={7}
                  className="resize-none min-h-[160px]"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Quick suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Model Showcase', instruction: 'Keep the model/product from reference images consistent. Maintain exact clothing, accessories, and styling throughout the video.' },
                    { label: 'Product Identity', instruction: 'Preserve exact product appearance: colors, logos, textures must match references precisely. Essential for brand recognition.' },
                    { label: 'Scene Composition', instruction: 'Reference images by number: "model from image 1 walks through environment from image 2". Build narrative using all references.' },
                    { label: 'Character Action', instruction: 'Add dynamic actions while preserving reference appearance: walking, interacting with product, showcasing clothing movement.' },
                    { label: 'Cinematic Style', instruction: 'Apply cinematic treatment: dramatic lighting, professional color grading, flattering camera angles for the referenced subjects.' },
                    { label: 'Brand Environment', instruction: 'Place referenced subject in aspirational environment: luxury studio, urban setting, or natural outdoor scene.' }
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
                  💡 <strong>Tip:</strong> Describe how to use your reference images. Reference them as "image 1", "image 2", etc.
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

export default VeoReferenceImages;

