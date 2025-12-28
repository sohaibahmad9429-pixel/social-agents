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
  Upload,
  ImageIcon,
  X,
  FolderOpen,
  RefreshCw,
  ChevronLeft,
  AlertCircle,
  ChevronDown,
  Check,
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
  thumbnail_url?: string;
}

interface VeoImageToVideoProps {
  onGenerationStarted: (video: GeneratedVeoVideo, historyAction: string) => void;
  onError: (error: string) => void;
  isGenerating: boolean;
  recentImages: GeneratedImage[];
  workspaceId?: string | null;
}

// ============================================================================
// Component
// ============================================================================

export function VeoImageToVideo({
  onGenerationStarted,
  onError,
  isGenerating,
  recentImages,
  workspaceId,
}: VeoImageToVideoProps) {
  // State
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<VeoModel>('veo-3.1-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<VeoAspectRatio>('16:9');
  const [duration, setDuration] = useState<VeoDuration>(8);
  const [resolution, setResolution] = useState<VeoResolution>('720p');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<'upload' | 'library' | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

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
    if (showLibraryPicker) {
      fetchLibraryImages();
    }
  }, [showLibraryPicker, fetchLibraryImages]);

  // Validation: 1080p only available for 8s duration
  const is1080pDisabled = duration !== 8;

  React.useEffect(() => {
    if (resolution === '1080p' && duration !== 8) {
      setResolution('720p');
    }
  }, [duration, resolution]);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      onError('Please upload a JPEG, PNG, or WebP image');
      return;
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      onError('Image must be under 20MB');
      return;
    }

    // Convert to data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageUrl(event.target?.result as string);
      setImageSource('upload');
    };
    reader.readAsDataURL(file);
  }, [onError]);

  // Handle library image selection
  const handleSelectLibraryImage = useCallback((url: string) => {
    setImageUrl(url);
    setImageSource('library');
    setShowLibraryPicker(false);
  }, []);

  // Clear image
  const handleClearImage = useCallback(() => {
    setImageUrl(null);
    setImageSource(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          mediaSubType: 'image-to-video',
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
      onError('Please enter a prompt describing how the image should animate');
      return;
    }

    if (!imageUrl) {
      onError('Please upload or select an image');
      return;
    }

    try {
      const response = await fetch('/api/ai/media/veo/image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: prompt.trim(),
          model,
          aspectRatio,
          durationSeconds: duration,
          resolution,
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
          generation_mode: 'image',
          input_image_url: imageUrl,
        },
        status: 'pending',
        progress: 0,
        createdAt: Date.now(),
        hasAudio: true,
        operationId: data.operationId,
        operationName: data.operationName,
        extensionCount: 0,
        isExtendable: true,
        thumbnailUrl: imageUrl,
      };

      onGenerationStarted(video, 'veo-image');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to generate video');
    }
  }, [prompt, imageUrl, model, aspectRatio, duration, resolution, onGenerationStarted, onError]);

  return (
    <div className="space-y-4">
      {/* Image Upload Section */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <Label className="text-sm font-medium">First Frame Image</Label>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isGenerating}
        />

        {/* Show selected image or picker */}
        {imageUrl ? (
          <div className="space-y-2">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border">
              <img src={imageUrl} alt="Selected" className="w-full h-full object-contain" />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleClearImage}
                disabled={isGenerating}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-green-500">✓</span>
              <span>{imageSource === 'upload' ? 'Uploaded image' : 'From library'} - Will be used as first frame</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowLibraryPicker(true)}
              disabled={isGenerating}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Change Image
            </Button>
          </div>
        ) : showLibraryPicker ? (
          /* Library Picker View */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLibraryPicker(false)}
                className="h-8 px-2"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <span className="text-sm font-medium">Select from Library</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchLibraryImages}
                className="h-8 px-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingLibrary ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : libraryImages.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 max-h-[250px] overflow-y-auto">
                {libraryImages.map((item) => (
                  <button
                    key={item.id}
                    className="aspect-video bg-muted rounded-md overflow-hidden transition-all hover:ring-2 hover:ring-purple-500"
                    onClick={() => handleSelectLibraryImage(item.url)}
                  >
                    <img src={item.url} alt={item.prompt || 'Library image'} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No images in library</p>
                <p className="text-xs">Generate some images first</p>
              </div>
            )}

          </div>
        ) : (
          /* Initial Selection - Upload icon opens library */
          <Button
            variant="outline"
            className="w-full h-24 border-dashed flex items-center justify-center"
            onClick={() => setShowLibraryPicker(true)}
            disabled={isGenerating}
          >
            <Upload className="w-6 h-6 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Prompt */}
      <div className="space-y-2">
        <Label htmlFor="prompt" className="text-sm font-medium">
          Animation Prompt
        </Label>
        <Textarea
          id="prompt"
          placeholder="Describe how the image should animate... E.g., The camera slowly zooms in as the person turns their head and smiles"
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
        disabled={isGenerating || !prompt.trim() || !imageUrl}
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
            Animate Image
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
                  <p className="text-xs text-muted-foreground">Enhance image-to-video animation prompt</p>
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
                  placeholder="Example: Add camera movements, describe animation flow, include motion details..."
                  rows={7}
                  className="resize-none min-h-[160px]"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Quick suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Product Animation', instruction: 'Animate the product with subtle rotation or floating motion. Add natural lighting shifts. Make it suitable for e-commerce or brand showcase.' },
                    { label: 'Camera Motion', instruction: 'Add camera movement starting from this image: slow dolly, arc around subject, or crane reveal. Build cinematic motion from the opening frame.' },
                    { label: 'Lifestyle Scene', instruction: 'Add subtle environmental motion: leaves rustling, fabric swaying, hair moving. Create a living lifestyle atmosphere.' },
                    { label: 'Audio Design', instruction: 'Add ambient audio: background music, environmental sounds, or product sounds. Describe the soundscape for Veo native audio.' },
                    { label: 'Dramatic Reveal', instruction: 'Create a dramatic reveal with lighting change, camera push-in, or focus pull. Build anticipation for the product.' },
                    { label: 'Motion Details', instruction: 'Specify which elements should move: head turning, hands touching product, fabric in wind. Describe motion beat-by-beat.' }
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
                  💡 <strong>Tip:</strong> Describe how the image should animate. The AI will add professional camera work and motion details.
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

export default VeoImageToVideo;

