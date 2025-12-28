'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Edit3,
  Image as ImageIcon,
  Download,
  Loader2,
  RefreshCw,
  X,
  Eraser,
  Layers,
  Upload,
  Undo,
  RotateCcw,
  Paintbrush,
  Info,
  Sliders,
  Sparkles,
  FolderOpen,
  ChevronLeft,
  MessageSquare,
  Globe,
  Zap,
  History,
  Search,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { GeneratedImage } from '../types/mediaStudio.types';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import { AI_MODELS, DEFAULT_AI_MODEL_ID, getModelDisplayName } from '@/constants/aiModels';
import { ChevronDown } from 'lucide-react';

interface ImageEditorProps {
  onImageGenerated: (image: GeneratedImage) => void;
  recentImages: GeneratedImage[];
}

// ============================================================================
// EDIT MODES - Per OpenAI API Docs
// ============================================================================

type EditMode = 'inpaint' | 'reference' | 'gemini' | 'multi-turn';

// Conversation message type for multi-turn editing
interface ConversationMessage {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    inline_data?: {
      mime_type: string;
      data: string;
    };
    thought_signature?: string;
  }>;
}

interface EditModeConfig {
  value: EditMode;
  label: string;
  description: string;
  icon: React.ElementType;
  endpoint: string;
}

const EDIT_MODES: EditModeConfig[] = [
  {
    value: 'inpaint',
    label: 'Inpaint (Mask)',
    description: 'Paint over areas to edit with a mask',
    icon: Paintbrush,
    endpoint: '/api/ai/media/image/inpaint',
  },
  {
    value: 'reference',
    label: 'Reference Style',
    description: 'Generate new image using style reference',
    icon: Layers,
    endpoint: '/api/ai/media/image/reference',
  },
  {
    value: 'gemini',
    label: 'Gemini 3 Pro',
    description: 'Advanced AI editing with 4K support',
    icon: Sparkles,
    endpoint: '/api/ai/media/imagen',
  },
  {
    value: 'multi-turn',
    label: 'Multi-Turn Chat',
    description: 'Iterative refinement with conversation history',
    icon: MessageSquare,
    endpoint: '/api/ai/media/imagen',
  },
];

// Input fidelity options for reference mode
const FIDELITY_OPTIONS = [
  { value: 'high', label: 'High Fidelity', description: 'Closely follow reference details' },
  { value: 'low', label: 'Low Fidelity', description: 'More creative freedom' },
];

// ============================================================================
// OPENAI EDIT OPTIONS - Per latest API docs
// ============================================================================

const OPENAI_EDIT_SIZES = [
  { value: '1024x1024', label: 'Square (1024×1024)' },
  { value: '1536x1024', label: 'Landscape (1536×1024)' },
  { value: '1024x1536', label: 'Portrait (1024×1536)' },
];

const OPENAI_EDIT_QUALITIES = [
  { value: 'low', label: 'Low (Fastest)' },
  { value: 'medium', label: 'Medium (Balanced)' },
  { value: 'high', label: 'High (Best Quality)' },
];

const OPENAI_EDIT_FORMATS = [
  { value: 'png', label: 'PNG', description: 'Best for transparency' },
  { value: 'jpeg', label: 'JPEG', description: 'Smaller file size' },
  { value: 'webp', label: 'WebP', description: 'Modern, efficient' },
];

const OPENAI_EDIT_BACKGROUNDS = [
  { value: 'auto', label: 'Auto', description: 'AI decides' },
  { value: 'transparent', label: 'Transparent', description: 'PNG/WebP only' },
  { value: 'opaque', label: 'Opaque', description: 'Solid background' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ImageEditor({ onImageGenerated, recentImages }: ImageEditorProps) {
  // Media Library hook for saving to database
  const { saveGeneratedMedia, createHistoryEntry, markGenerationFailed, isEnabled: canSaveToDb, workspaceId } = useMediaLibrary();

  // State
  const [editMode, setEditMode] = useState<EditMode>('inpaint');
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [inputFidelity, setInputFidelity] = useState<'low' | 'high'>('high');

  // OpenAI edit options state
  const [editSize, setEditSize] = useState('1024x1024');
  const [editQuality, setEditQuality] = useState('medium');
  const [editFormat, setEditFormat] = useState('png');
  const [editBackground, setEditBackground] = useState('auto');

  // Gemini 3 Pro edit options
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [imageSize, setImageSize] = useState<string>('2K');
  const [enableGoogleSearch, setEnableGoogleSearch] = useState(false);
  // Reference images for Gemini 3 Pro (up to 14: 6 objects + 5 humans + main image)
  const [referenceImages, setReferenceImages] = useState<Array<{ data: string; mimeType: string; preview: string }>>([]);

  // Multi-turn conversation state
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; imageUrl?: string }>>([]);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Library picker state
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [showRefLibraryPicker, setShowRefLibraryPicker] = useState(false);
  const [libraryImages, setLibraryImages] = useState<any[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [selectedRefImages, setSelectedRefImages] = useState<Set<string>>(new Set()); // For multi-select

  // Canvas state for inpainting
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);

  // Prompt improvement state
  const [showImprovementModal, setShowImprovementModal] = useState(false);
  const [improvementInstructions, setImprovementInstructions] = useState('');
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [improvementError, setImprovementError] = useState<string | null>(null);
  const [selectedAIModelId, setSelectedAIModelId] = useState(DEFAULT_AI_MODEL_ID);
  const [showAIModelDropdown, setShowAIModelDropdown] = useState(false);

  // Convert technical errors to user-friendly messages
  const getUserFriendlyError = (error: unknown): string => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('API_KEY') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return 'API key not configured. Please check your settings.';
    }
    if (errorMessage.includes('429') || errorMessage.includes('rate') || errorMessage.includes('quota') || errorMessage.includes('insufficient')) {
      return 'Rate limit or quota exceeded. Add credits or try a different model.';
    }
    if (errorMessage.includes('model') && (errorMessage.includes('not found') || errorMessage.includes('does not exist'))) {
      return 'Selected model is unavailable. Try a different model.';
    }
    if (errorMessage.includes('MODULE_NOT_FOUND') || errorMessage.includes('Cannot find module')) {
      return 'Service temporarily unavailable. Please try again.';
    }
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      return 'Connection error. Please check your internet.';
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return 'Request timed out. Please try again.';
    }
    return 'Failed to improve prompt. Please try again.';
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMode = EDIT_MODES.find(m => m.value === editMode)!;

  const removeReferenceImage = useCallback((index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Toggle selection of a reference image in multi-select mode
  const toggleRefImageSelection = useCallback((imageId: string) => {
    setSelectedRefImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        // Check if we can add more (max 13 - current count)
        const remainingSlots = 13 - referenceImages.length;
        if (newSet.size < remainingSlots) {
          newSet.add(imageId);
        }
      }
      return newSet;
    });
  }, [referenceImages.length]);

  // Add selected reference images from library
  const addSelectedReferenceImages = useCallback(async () => {
    if (selectedRefImages.size === 0) return;

    const selectedUrls = libraryImages
      .filter((img) => selectedRefImages.has(img.id))
      .map((img) => img.url);

    // Process each selected image
    for (const imageUrl of selectedUrls) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const reader = new FileReader();

        await new Promise<void>((resolve) => {
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              setReferenceImages((prev) => [
                ...prev.slice(0, 13), // Ensure max 13
                {
                  data: match[2],
                  mimeType: match[1],
                  preview: dataUrl,
                },
              ].slice(0, 13));
            }
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      } catch (err) {
      }
    }

    // Clear selection and close picker
    setSelectedRefImages(new Set());
    setShowRefLibraryPicker(false);
  }, [selectedRefImages, libraryImages]);

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

  // Handle selecting image from library
  const handleLibrarySelect = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setUploadedImage(imageUrl);
    setShowLibraryPicker(false);
    clearMask();
    setError(null);
  };

  // Initialize canvas when image is selected (inpaint mode)
  useEffect(() => {
    if (selectedImage && canvasRef.current && editMode === 'inpaint') {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
      img.src = selectedImage;
    }
  }, [selectedImage, editMode]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      setUploadedImage(imageUrl);
      setSelectedImage(imageUrl);
      clearMask();
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Drawing handlers for inpaint mask
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || editMode !== 'inpaint') return;
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || editMode !== 'inpaint') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Draw red overlay for visibility (will be converted to mask)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize * scaleX, 0, Math.PI * 2);
    ctx.fill();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      const maskUrl = canvasRef.current.toDataURL('image/png');
      setMaskDataUrl(maskUrl);
    }
    setIsDrawing(false);
  };

  const clearMask = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setMaskDataUrl(null);
    }
  };

  // Convert drawn mask to proper transparency mask for API
  const createProperMask = (): string | null => {
    if (!canvasRef.current || !maskDataUrl) return null;

    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return null;

    maskCanvas.width = canvasRef.current.width;
    maskCanvas.height = canvasRef.current.height;

    // Create white background (areas to keep)
    maskCtx.fillStyle = 'white';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    // Get the drawn mask data
    const originalCtx = canvasRef.current.getContext('2d');
    if (!originalCtx) return null;

    const imageData = originalCtx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

    // Where we drew (red areas), make transparent
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 200 && imageData.data[i + 3] > 0) {
        maskImageData.data[i + 3] = 0; // Make transparent
      }
    }
    maskCtx.putImageData(maskImageData, 0, 0);

    return maskCanvas.toDataURL('image/png');
  };

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
      // Determine media sub-type based on edit mode
      let mediaSubType: string;
      if (editMode === 'inpaint') mediaSubType = 'inpaint';
      else if (editMode === 'reference') mediaSubType = 'reference';
      else if (editMode === 'gemini') mediaSubType = 'gemini-edit';
      else mediaSubType = 'multi-turn';

      const response = await fetch('/api/ai/media/prompt/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPrompt: prompt,
          mediaType: 'image-editing',
          mediaSubType: mediaSubType,
          provider: editMode === 'gemini' || editMode === 'multi-turn' ? 'google' : 'openai',
          userInstructions: improvementInstructions || undefined,
          modelId: selectedAIModelId,
          context: {
            aspectRatio: aspectRatio,
            resolution: imageSize,
            hasReferenceImage: editMode === 'reference' || referenceImages.length > 0,
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

  // Generate edited image
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt describing the result');
      return;
    }

    if (!selectedImage) {
      setError('Please select an image to edit');
      return;
    }

    if (editMode === 'inpaint' && !maskDataUrl) {
      setError('Please draw a mask over the areas you want to edit');
      return;
    }

    setIsGenerating(true);
    setError(null);
    const startTime = Date.now();

    // Determine source type for database (must match MediaSource type)
    const sourceType = editMode === 'inpaint' ? 'inpaint' : editMode === 'reference' ? 'reference' : 'edited';
    const modelName = (editMode === 'gemini' || editMode === 'multi-turn') ? 'gemini-image' : 'gpt-image-1.5';

    // Create history entry for tracking
    const historyId = canSaveToDb ? await createHistoryEntry({
      type: 'image',
      action: sourceType as any,
      prompt,
      model: modelName,
      config: { editMode, inputFidelity },
      inputMediaUrls: [selectedImage],
    }) : null;

    try {
      let response;

      if (editMode === 'inpaint') {
        // Inpainting with mask - POST /api/ai/media/image/inpaint
        const properMaskUrl = createProperMask();
        if (!properMaskUrl) {
          throw new Error('Failed to create mask');
        }

        response = await fetch('/api/ai/media/image/inpaint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalImageUrl: selectedImage,
            maskImageUrl: properMaskUrl,
            prompt,
            size: editSize,
            quality: editQuality,
            format: editFormat,
            background: editBackground,
          }),
        });
      } else if (editMode === 'reference') {
        // Reference-based generation - POST /api/ai/media/image/reference
        response = await fetch('/api/ai/media/image/reference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referenceImages: [selectedImage],
            prompt,
            input_fidelity: inputFidelity,
            size: editSize,
            quality: editQuality,
            format: editFormat,
            background: editBackground,
          }),
        });
      } else if (editMode === 'multi-turn') {
        // Multi-turn conversational editing - POST /api/ai/media/imagen
        response = await fetch('/api/ai/media/imagen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'multi-turn',
            prompt,
            conversationHistory,
            aspectRatio,
            imageSize,
            responseModalities: ['TEXT', 'IMAGE'],
            enableGoogleSearch,
          }),
        });
      } else {
        // Gemini 3 Pro Image edit - POST /api/ai/media/imagen
        // Supports up to 14 reference images (6 objects + 5 humans + main image)
        response = await fetch('/api/ai/media/imagen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'edit',
            imageUrl: selectedImage,
            prompt,
            model: 'gemini-3-pro-image-preview',
            aspectRatio,
            imageSize,
            responseModalities: ['TEXT', 'IMAGE'],
            enableGoogleSearch,
            referenceImages: referenceImages.map(img => ({ data: img.data, mimeType: img.mimeType })),
          }),
        });
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to edit image');
      }

      // Handle different response formats
      let editedImageUrl: string;
      if (editMode === 'gemini' || editMode === 'multi-turn') {
        editedImageUrl = data.images[0];

        // Store AI text response
        if (data.text) {
          setAiResponse(data.text);
        }

        // Update conversation history for multi-turn
        if (editMode === 'multi-turn' && data.conversationHistory) {
          setConversationHistory(data.conversationHistory);

          // Add to chat messages for display
          setChatMessages(prev => [
            ...prev,
            { role: 'user', content: prompt },
            { role: 'assistant', content: data.text || 'Image generated', imageUrl: editedImageUrl },
          ]);
        }
      } else {
        editedImageUrl = data.data.imageUrl;
      }

      const editedImage: GeneratedImage = {
        id: `edit_${Date.now()}`,
        url: editedImageUrl,
        prompt,
        config: {},
        createdAt: Date.now(),
        type: editMode === 'inpaint' ? 'edited' : editMode === 'reference' ? 'reference' : 'edited',
      };

      // Save to database
      if (canSaveToDb) {
        try {
          // Don't store full base64 in config - truncate or skip if it's a data URL
          const originalUrlForConfig = selectedImage?.startsWith('data:')
            ? 'base64-image'
            : selectedImage;

          const savedResult = await saveGeneratedMedia({
            type: 'image',
            source: sourceType as any,
            url: editedImageUrl,
            prompt,
            model: modelName,
            config: {
              editMode,
              inputFidelity,
              originalImageUrl: originalUrlForConfig,
              editType: editMode === 'inpaint' ? 'Inpaint (Mask)' : editMode === 'reference' ? 'Reference Style' : 'Gemini Edit',
            },
          }, historyId, Date.now() - startTime);
          if (!savedResult.success) {
          }
        } catch (saveError) {
        }
      } else {
      }

      setEditedImageUrl(editedImageUrl);
      onImageGenerated(editedImage);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Editing failed';
      setError(errorMsg);
      if (historyId) {
        await markGenerationFailed(historyId, errorMsg);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, selectedImage, maskDataUrl, editMode, inputFidelity, onImageGenerated, canSaveToDb, createHistoryEntry, saveGeneratedMedia, markGenerationFailed, aspectRatio, imageSize, enableGoogleSearch, conversationHistory, referenceImages]);

  // Download edited image
  const handleDownload = async () => {
    if (!editedImageUrl) return;
    try {
      const response = await fetch(editedImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_${editMode}_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Editor Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Edit Image
          </CardTitle>
          <CardDescription>
            Inpainting, style transfer, and smart editing with Gemini 3 Pro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Edit Mode Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Edit Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {EDIT_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => {
                    setEditMode(mode.value);
                    clearMask();
                  }}
                  className={`p-3 rounded-lg border text-center transition-all ${editMode === mode.value
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border hover:border-primary/50'
                    }`}
                >
                  <mode.icon className="w-5 h-5 mx-auto mb-1" />
                  <div className="font-medium text-xs">{mode.label}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{currentMode.description}</p>
          </div>

          {/* Image Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Source Image</label>
              <Badge variant="secondary" className="text-xs">Required</Badge>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Show selected image or picker */}
            {uploadedImage ? (
              <div className="space-y-2">
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border">
                  <img src={uploadedImage} alt="Selected" className="w-full h-full object-contain" />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setUploadedImage(null);
                      setSelectedImage(null);
                      clearMask();
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowLibraryPicker(true)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Change Image
                </Button>
              </div>
            ) : showLibraryPicker ? (
              /* Library Picker View */
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
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
                  <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                    {libraryImages.map((item) => (
                      <button
                        key={item.id}
                        className="aspect-square bg-muted rounded-md overflow-hidden transition-all hover:ring-2 hover:ring-primary"
                        onClick={() => handleLibrarySelect(item.url)}
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

                {/* Upload option in library picker */}
                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload from Computer
                  </Button>
                </div>
              </div>
            ) : (
              /* Initial Selection Options */
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-20 border-dashed"
                  onClick={() => setShowLibraryPicker(true)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <FolderOpen className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm font-medium">Select from Library</span>
                    <span className="text-xs text-muted-foreground">Choose from your generated images</span>
                  </div>
                </Button>

                {/* Recent images quick access */}
                {recentImages.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Recent images:</label>
                    <div className="grid grid-cols-4 gap-2">
                      {recentImages.slice(0, 4).map((img) => (
                        <button
                          key={img.id}
                          className="aspect-square bg-muted rounded-md overflow-hidden transition-all hover:ring-2 hover:ring-primary"
                          onClick={() => handleLibrarySelect(img.url)}
                        >
                          <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* INPAINT MODE: Canvas for drawing mask */}
          {editMode === 'inpaint' && selectedImage && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Paintbrush className="w-4 h-4" />
                  Draw Mask
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Brush:</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-xs w-8">{brushSize}px</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearMask}>
                    <Undo className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>

              <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                <img
                  src={selectedImage}
                  alt="Source"
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Paint red over areas you want to change. The AI will regenerate those areas.
              </p>
            </div>
          )}

          {/* REFERENCE MODE: Fidelity Selection */}
          {editMode === 'reference' && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Input Fidelity
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FIDELITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setInputFidelity(opt.value as 'low' | 'high')}
                    className={`p-3 rounded-lg border text-left transition-all ${inputFidelity === opt.value
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                      }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* OPENAI EDIT OPTIONS - For inpaint and reference modes */}
          {(editMode === 'inpaint' || editMode === 'reference') && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                <span className="text-sm font-medium">Output Options</span>
              </div>

              {/* Size */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {OPENAI_EDIT_SIZES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setEditSize(s.value)}
                      className={`p-2 rounded-lg border text-center transition-all ${editSize === s.value
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-border hover:border-primary/50'
                        }`}
                    >
                      <div className="font-medium text-xs">{s.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Quality</label>
                <div className="grid grid-cols-3 gap-2">
                  {OPENAI_EDIT_QUALITIES.map((q) => (
                    <button
                      key={q.value}
                      onClick={() => setEditQuality(q.value)}
                      className={`p-2 rounded-lg border text-center transition-all ${editQuality === q.value
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-border hover:border-primary/50'
                        }`}
                    >
                      <div className="font-medium text-xs">{q.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format and Background Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Format</label>
                  <select
                    value={editFormat}
                    onChange={(e) => setEditFormat(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                  >
                    {OPENAI_EDIT_FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Background</label>
                  <select
                    value={editBackground}
                    onChange={(e) => setEditBackground(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                  >
                    {OPENAI_EDIT_BACKGROUNDS.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Transparent background works with PNG/WebP and medium+ quality
              </p>
            </div>
          )}

          {/* GEMINI MODE: Aspect Ratio and Resolution */}
          {editMode === 'gemini' && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value="1:1">Square (1:1)</option>
                  <option value="2:3">Portrait (2:3)</option>
                  <option value="3:2">Landscape (3:2)</option>
                  <option value="3:4">Portrait (3:4)</option>
                  <option value="4:3">Landscape (4:3)</option>
                  <option value="4:5">Portrait (4:5)</option>
                  <option value="5:4">Photo (5:4)</option>
                  <option value="9:16">Story (9:16)</option>
                  <option value="16:9">Wide (16:9)</option>
                  <option value="21:9">Ultra Wide (21:9)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution</label>
                <div className="grid grid-cols-3 gap-2">
                  {['1K', '2K', '4K'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setImageSize(size)}
                      className={`p-2 rounded-lg border text-center transition-all ${imageSize === size
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border hover:border-primary/50'
                        }`}
                    >
                      <div className="font-medium text-sm">{size}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Google Search Grounding */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-lg border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <div>
                    <label className="text-sm font-medium">Google Search</label>
                    <p className="text-xs text-muted-foreground">Ground edits with real-time data</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableGoogleSearch}
                  onClick={() => setEnableGoogleSearch(!enableGoogleSearch)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enableGoogleSearch ? 'bg-blue-500' : 'bg-muted'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableGoogleSearch ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {/* Reference Images Section */}
              <div className="space-y-2 p-3 border rounded-lg bg-background/50">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Reference Images ({referenceImages.length}/13)
                  </label>
                  {referenceImages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReferenceImages([])}
                      className="h-7 text-xs"
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Add up to 13 additional images: 6 objects (high-fidelity) + 5 humans (character consistency)
                </p>

                {/* Reference images grid */}
                {referenceImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {referenceImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square bg-muted rounded-md overflow-hidden group">
                        <img src={img.preview} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeReferenceImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Library Picker for Reference Images - Multi-Select with Checkboxes */}
                {referenceImages.length < 13 && (
                  showRefLibraryPicker ? (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Select Images ({selectedRefImages.size} selected)
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRefImages(new Set());
                              setShowRefLibraryPicker(false);
                            }}
                            className="h-7 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={fetchLibraryImages}
                          >
                            <RefreshCw className={`w-4 h-4 ${isLoadingLibrary ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      </div>

                      {isLoadingLibrary ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : libraryImages.length > 0 ? (
                        <>
                          <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                            {libraryImages.map((item) => {
                              const isSelected = selectedRefImages.has(item.id);
                              const canSelect = isSelected || selectedRefImages.size < (13 - referenceImages.length);
                              return (
                                <button
                                  key={item.id}
                                  className={`relative aspect-square bg-muted rounded-md overflow-hidden transition-all ${isSelected ? 'ring-2 ring-primary' : canSelect ? 'hover:ring-2 hover:ring-primary/50' : 'opacity-50 cursor-not-allowed'
                                    }`}
                                  onClick={() => canSelect && toggleRefImageSelection(item.id)}
                                  disabled={!canSelect}
                                >
                                  <img src={item.url} alt={item.prompt || 'Library image'} className="w-full h-full object-cover" />
                                  {/* Checkbox overlay */}
                                  <div className={`absolute top-1 left-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'bg-background/80 border-muted-foreground/50'
                                    }`}>
                                    {isSelected && (
                                      <Check className="w-3 h-3 text-primary-foreground" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {/* Add Selected Button */}
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={addSelectedReferenceImages}
                            disabled={selectedRefImages.size === 0}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Add {selectedRefImages.size} Image{selectedRefImages.size !== 1 ? 's' : ''}
                          </Button>
                        </>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                          <p className="text-xs">No images in library</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setShowRefLibraryPicker(true);
                        fetchLibraryImages();
                      }}
                    >
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Add from Library
                    </Button>
                  )
                )}
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Gemini 3 Pro supports up to 4K resolution and 14 total images
              </p>
            </div>
          )}

          {/* MULTI-TURN MODE: Conversation History and Settings */}
          {editMode === 'multi-turn' && (
            <div className="space-y-4">
              {/* Settings Panel */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="w-4 h-4" />
                  Multi-Turn Settings
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Aspect Ratio</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="1:1">1:1</option>
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                      <option value="4:3">4:3</option>
                      <option value="3:4">3:4</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Resolution</label>
                    <select
                      value={imageSize}
                      onChange={(e) => setImageSize(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="1K">1K</option>
                      <option value="2K">2K</option>
                      <option value="4K">4K</option>
                    </select>
                  </div>
                </div>

                {/* Google Search Toggle */}
                <div className="flex items-center justify-between p-2 bg-blue-500/5 rounded border border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Google Search</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableGoogleSearch}
                    onClick={() => setEnableGoogleSearch(!enableGoogleSearch)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enableGoogleSearch ? 'bg-blue-500' : 'bg-muted'
                      }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${enableGoogleSearch ? 'translate-x-5' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>
              </div>

              {/* Conversation History */}
              {chatMessages.length > 0 && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <History className="w-4 h-4" />
                      Conversation ({chatMessages.length} messages)
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setConversationHistory([]);
                        setChatMessages([]);
                        setAiResponse(null);
                      }}
                      className="h-7 text-xs"
                    >
                      Clear History
                    </Button>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-2">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg text-sm ${msg.role === 'user'
                          ? 'bg-primary/10 ml-4'
                          : 'bg-muted mr-4'
                          }`}
                      >
                        <div className="text-xs text-muted-foreground mb-1">
                          {msg.role === 'user' ? 'You' : 'AI'}
                        </div>
                        <p className="text-sm">{msg.content}</p>
                        {msg.imageUrl && (
                          <img
                            src={msg.imageUrl}
                            alt="Generated"
                            className="mt-2 rounded max-h-24 object-contain"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Each message builds on previous context. Clear history to start fresh.
              </p>
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {editMode === 'inpaint'
                ? 'Describe the FULL result image'
                : editMode === 'reference'
                  ? 'Describe what to generate using this style'
                  : editMode === 'multi-turn'
                    ? chatMessages.length > 0 ? 'Continue the conversation' : 'Start a new image creation'
                    : 'Describe the edit you want'}
            </label>
            <Textarea
              placeholder={
                editMode === 'inpaint'
                  ? "Describe the complete image you want (not just the changed areas)..."
                  : editMode === 'reference'
                    ? "Describe the new image you want to create using this reference style..."
                    : editMode === 'multi-turn'
                      ? chatMessages.length > 0
                        ? "Refine the image: 'Make it more colorful', 'Add a sunset', 'Change to Spanish'..."
                        : "Describe the image you want to create..."
                      : "Describe how you want to edit this image..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <div className="flex items-center justify-start gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImprovePrompt}
                disabled={isImprovingPrompt || !prompt.trim()}
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

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <X className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={
              isGenerating ||
              !prompt.trim() ||
              (editMode !== 'multi-turn' && !selectedImage) ||
              (editMode === 'inpaint' && !maskDataUrl)
            }
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {editMode === 'multi-turn' ? 'Generating...' : 'Processing...'}
              </>
            ) : (
              <>
                {editMode === 'multi-turn' ? (
                  <MessageSquare className="w-4 h-4 mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {editMode === 'inpaint'
                  ? 'Apply Inpainting'
                  : editMode === 'reference'
                    ? 'Generate from Reference'
                    : editMode === 'multi-turn'
                      ? chatMessages.length > 0 ? 'Send Message' : 'Start Conversation'
                      : 'Apply Gemini 3 Pro Edit'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Result
          </CardTitle>
          <CardDescription>
            Edited image preview
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Result Preview */}
          <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-4">
            {isGenerating ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">
                  {editMode === 'inpaint' ? 'Applying inpainting...' : 'Processing edit...'}
                </p>
              </div>
            ) : editedImageUrl ? (
              <img
                src={editedImageUrl}
                alt="Edited image"
                className="w-full h-full object-contain"
              />
            ) : selectedImage ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                <img
                  src={selectedImage}
                  alt="Selected"
                  className="max-w-full max-h-[80%] object-contain opacity-50"
                />
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Original image. Edit result will appear here.
                </p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <ImageIcon className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground text-center px-4">
                  Select an image and apply an edit
                </p>
              </div>
            )}
          </div>

          {/* AI Response Text */}
          {aiResponse && editedImageUrl && (
            <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/5 to-pink-500/5 border border-purple-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-purple-600">AI Response</span>
              </div>
              <p className="text-sm text-muted-foreground">{aiResponse}</p>
            </div>
          )}

          {/* Actions */}
          {editedImageUrl && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedImage(editedImageUrl);
                  setEditedImageUrl(null);
                  clearMask();
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Edit Again
              </Button>
              <Button
                variant="outline"
                className="col-span-2"
                onClick={() => {
                  setEditedImageUrl(null);
                  setAiResponse(null);
                  clearMask();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear Result
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-r from-purple-500/10 to-pink-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Improve Prompt with AI</h3>
                  <p className="text-xs text-muted-foreground">Enhance your image editing prompt</p>
                </div>
              </div>
              <button
                onClick={() => setShowImprovementModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  What would you like to improve? <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Textarea
                  value={improvementInstructions}
                  onChange={(e) => setImprovementInstructions(e.target.value)}
                  placeholder="Example: More specific edit instructions, add style consistency notes, include blending requirements..."
                  rows={7}
                  className="resize-none min-h-[160px]"
                />
              </div>

              {/* Quick Suggestions */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Quick suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Product Swap', instruction: 'Replace product in masked area with new product. Match lighting, shadows, and perspective for seamless integration.' },
                    { label: 'Background Change', instruction: 'Change background while preserving subject. Describe new environment and match lighting for natural blending.' },
                    { label: 'Style Transfer', instruction: 'Apply style (cinematic, vintage, editorial) while preserving content. Transform colors and texture, keep product recognizable.' },
                    { label: 'Add Element', instruction: 'Add new element to scene. Describe position, size, and how it matches existing lighting and shadows.' },
                    { label: 'Remove & Fill', instruction: 'Remove unwanted element and fill naturally. Describe what should replace the area for texture continuity.' },
                    { label: 'Color & Lighting', instruction: 'Adjust colors and lighting: warm shadows, golden glow, enhanced highlights. Specify color grading style.' }
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
                  <button
                    type="button"
                    onClick={() => setShowAIModelDropdown(!showAIModelDropdown)}
                    className="px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 transition-colors bg-muted/50 text-foreground flex items-center gap-2 text-xs"
                  >
                    <span>{getModelDisplayName(selectedAIModelId)}</span>
                    <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showAIModelDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showAIModelDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto whitespace-nowrap">
                      {AI_MODELS.map((aiModel) => (
                        <button
                          key={aiModel.id}
                          type="button"
                          onClick={() => {
                            setSelectedAIModelId(aiModel.id);
                            setShowAIModelDropdown(false);
                          }}
                          className={`w-full px-3 py-1.5 text-left hover:bg-muted transition-colors flex items-center gap-2 text-xs ${selectedAIModelId === aiModel.id ? 'bg-primary/10' : ''
                            }`}
                        >
                          <span className="text-foreground">{aiModel.name} <span className="text-muted-foreground">({aiModel.providerLabel})</span></span>
                          {selectedAIModelId === aiModel.id && (
                            <Check className="w-3 h-3 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  💡 <strong>Tip:</strong> Provide clear editing instructions for better results. The AI will optimize for your {editMode} mode.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
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
