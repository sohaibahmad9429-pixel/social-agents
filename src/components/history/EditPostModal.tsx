'use client'

import React, { useState, useEffect } from 'react';
import { Post, Platform, PostContent, PlatformContentObject } from '@/types';
import { PLATFORMS } from '@/constants';
import { AI_MODELS, DEFAULT_AI_MODEL_ID, getModelDisplayName } from '@/constants/aiModels';
import { X, Save, AlertCircle, Check, Edit3, Sparkles, ChevronDown } from 'lucide-react';

interface EditPostModalProps {
    post: Post;
    onSave: (updatedPost: Post) => void;
    onClose: () => void;
}

interface PlatformEditState {
    content: string;
    title?: string;
    hashtags?: string[];
}

// Platform-specific character limits
const PLATFORM_LIMITS: Record<Platform, { caption: number; title?: number }> = {
    twitter: { caption: 280 },
    linkedin: { caption: 3000 },
    facebook: { caption: 63206 },
    instagram: { caption: 2200 },
    tiktok: { caption: 2200 },
    youtube: { caption: 5000, title: 100 },
};

// Platform-specific field labels
const PLATFORM_LABELS: Record<Platform, { main: string; secondary?: string }> = {
    twitter: { main: 'Tweet' },
    linkedin: { main: 'Post Content' },
    facebook: { main: 'Post Caption' },
    instagram: { main: 'Caption' },
    tiktok: { main: 'Caption' },
    youtube: { main: 'Description', secondary: 'Title' },
};

export function EditPostModal({ post, onSave, onClose }: EditPostModalProps) {
    const [activePlatform, setActivePlatform] = useState<Platform>(post.platforms[0]);
    const [editStates, setEditStates] = useState<Record<Platform, PlatformEditState>>({} as Record<Platform, PlatformEditState>);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isImprovingWithAI, setIsImprovingWithAI] = useState(false);
    const [improvementError, setImprovementError] = useState<string | null>(null);
    const [showImprovementModal, setShowImprovementModal] = useState(false);
    const [improvementInstructions, setImprovementInstructions] = useState('');
    const [selectedModelId, setSelectedModelId] = useState(DEFAULT_AI_MODEL_ID);
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    // Initialize edit states from post content
    useEffect(() => {
        const initialStates: Record<Platform, PlatformEditState> = {} as Record<Platform, PlatformEditState>;

        post.platforms.forEach(platform => {
            const platformContent = post.content[platform as keyof PostContent];

            if (typeof platformContent === 'string') {
                initialStates[platform] = {
                    content: platformContent || '',
                    title: undefined,
                    hashtags: [],
                };
            } else if (typeof platformContent === 'object' && platformContent) {
                const contentObj = platformContent as PlatformContentObject;
                initialStates[platform] = {
                    content: contentObj.content || contentObj.description || '',
                    title: contentObj.title,
                    hashtags: contentObj.hashtags || [],
                };
            } else {
                initialStates[platform] = {
                    content: post.topic || '',
                    title: undefined,
                    hashtags: [],
                };
            }
        });

        setEditStates(initialStates);
    }, [post]);

    const handleContentChange = (platform: Platform, field: 'content' | 'title', value: string) => {
        setEditStates(prev => ({
            ...prev,
            [platform]: {
                ...prev[platform],
                [field]: value,
            },
        }));
        setHasChanges(true);
        setSaveSuccess(false);
    };

    // Convert technical errors to user-friendly messages
    const getUserFriendlyError = (error: unknown): string => {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // API key issues
        if (errorMessage.includes('API_KEY') || errorMessage.includes('api_key') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
            return 'API key not configured. Please check your settings.';
        }

        // Rate limiting / quota exceeded
        if (errorMessage.includes('429') || errorMessage.includes('rate') || errorMessage.includes('quota') || errorMessage.includes('insufficient')) {
            return 'Rate limit or quota exceeded. Add credits or try a different model.';
        }

        // Model not found
        if (errorMessage.includes('model') && (errorMessage.includes('not found') || errorMessage.includes('does not exist'))) {
            return 'Selected model is unavailable. Try a different model.';
        }

        // Module/import errors
        if (errorMessage.includes('MODULE_NOT_FOUND') || errorMessage.includes('Cannot find module')) {
            return 'Service temporarily unavailable. Please try again.';
        }

        // Network errors
        if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
            return 'Connection error. Please check your internet.';
        }

        // Timeout
        if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
            return 'Request timed out. Please try again.';
        }

        // Generic fallback - keep it short
        return 'Failed to improve content. Please try again.';
    };

    const handleImproveWithAI = (platform: Platform) => {
        const currentContent = editStates[platform]?.content;

        if (!currentContent || currentContent.trim().length === 0) {
            setImprovementError('Please enter some content first');
            setTimeout(() => setImprovementError(null), 3000);
            return;
        }

        // Show improvement modal to get user instructions
        setShowImprovementModal(true);
        setImprovementError(null);
    };

    const handleSubmitImprovement = async () => {
        const currentContent = editStates[activePlatform]?.content;

        if (!currentContent) return;

        setIsImprovingWithAI(true);
        setImprovementError(null);
        setShowImprovementModal(false);

        try {
            // Use the Next.js proxy path which routes to the Python backend
            const response = await fetch('/py-api/content/improve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: currentContent,
                    platform: activePlatform,
                    postType: post.postType,
                    additionalInstructions: improvementInstructions || undefined,
                    modelId: selectedModelId,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to improve content');
            }

            // Update the content with improved version
            setEditStates(prev => ({
                ...prev,
                [activePlatform]: {
                    ...prev[activePlatform],
                    content: data.improvedDescription,
                },
            }));
            setHasChanges(true);
            setSaveSuccess(false);

            // Clear instructions for next time
            setImprovementInstructions('');

        } catch (error) {
            console.error('AI improvement error:', error);
            setImprovementError(getUserFriendlyError(error));
            setTimeout(() => setImprovementError(null), 5000);
        } finally {
            setIsImprovingWithAI(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);

        try {
            // Build updated content object
            const updatedContent: PostContent = { ...post.content };

            post.platforms.forEach(platform => {
                const editState = editStates[platform];
                if (!editState) return;

                const existingContent = post.content[platform as keyof PostContent];
                const platformKey = platform as keyof PostContent;

                // Preserve the structure (string or object) but update values
                if (typeof existingContent === 'object' && existingContent) {
                    // Update object format
                    const updatedObj: PlatformContentObject = {
                        ...(existingContent as PlatformContentObject),
                        content: editState.content,
                        description: editState.content, // Some platforms use description
                        title: editState.title,
                        hashtags: editState.hashtags,
                    };
                    (updatedContent as any)[platformKey] = updatedObj;
                } else {
                    // For YouTube and platforms that need object format for title
                    if (platform === 'youtube' && editState.title) {
                        const youtubeObj: PlatformContentObject = {
                            title: editState.title,
                            description: editState.content,
                            content: editState.content,
                            hashtags: editState.hashtags,
                        };
                        (updatedContent as any)[platformKey] = youtubeObj;
                    } else if (editState.hashtags && editState.hashtags.length > 0) {
                        // If we have hashtags, convert to object format
                        const objWithHashtags: PlatformContentObject = {
                            content: editState.content,
                            description: editState.content,
                            hashtags: editState.hashtags,
                        };
                        (updatedContent as any)[platformKey] = objWithHashtags;
                    } else {
                        // Keep string format
                        (updatedContent as any)[platformKey] = editState.content;
                    }
                }
            });

            const updatedPost: Post = {
                ...post,
                content: updatedContent,
            };

            await onSave(updatedPost);
            setSaveSuccess(true);
            setHasChanges(false);

            // Close modal after short delay to show success
            setTimeout(() => {
                onClose();
            }, 800);
        } catch (error) {
        } finally {
            setIsSaving(false);
        }
    };

    const currentEditState = editStates[activePlatform];
    const currentLimit = PLATFORM_LIMITS[activePlatform];
    const currentLabels = PLATFORM_LABELS[activePlatform];
    const charCount = currentEditState?.content?.length || 0;
    const isOverLimit = charCount > currentLimit.caption;

    // Get platform info for styling
    const platformInfo = PLATFORMS.find(p => p.id === activePlatform);
    const PlatformIcon = platformInfo?.icon;

    // Platform colors
    const platformColors: Record<Platform, { bg: string; text: string; border: string }> = {
        instagram: { bg: 'bg-gradient-to-r from-purple-600 to-pink-500', text: 'text-white', border: 'border-pink-500' },
        facebook: { bg: 'bg-[#1877F2]', text: 'text-white', border: 'border-[#1877F2]' },
        twitter: { bg: 'bg-black', text: 'text-white', border: 'border-black' },
        linkedin: { bg: 'bg-[#0A66C2]', text: 'text-white', border: 'border-[#0A66C2]' },
        tiktok: { bg: 'bg-black', text: 'text-white', border: 'border-black' },
        youtube: { bg: 'bg-[#FF0000]', text: 'text-white', border: 'border-[#FF0000]' },
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="relative bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-border"
                onClick={e => e.stopPropagation()}
            >
                {/* Header with Title and Platform Tabs */}
                <div className="flex items-center justify-between p-3 border-b border-border">
                    {/* Title - Top Left */}
                    <div className="flex items-center gap-2">
                        <Edit3 className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold text-foreground">Edit Post Content</h2>
                    </div>

                    {/* Platform Tabs - Top Right */}
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                        {post.platforms.map(platform => {
                            const info = PLATFORMS.find(p => p.id === platform);
                            if (!info) return null;
                            const Icon = info.icon;
                            const colors = platformColors[platform];
                            const isActive = activePlatform === platform;

                            return (
                                <button
                                    key={platform}
                                    onClick={() => setActivePlatform(platform)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm whitespace-nowrap ${isActive
                                        ? `${colors.bg} ${colors.text} shadow-lg scale-105`
                                        : 'bg-background text-foreground hover:bg-muted border border-border'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{info.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Edit Form */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-5">
                    {/* Title field (YouTube only) */}
                    {activePlatform === 'youtube' && (
                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-sm font-semibold text-foreground">
                                <span>{currentLabels.secondary || 'Title'}</span>
                                {currentLimit.title && (
                                    <span className={`text-xs font-normal ${(currentEditState?.title?.length || 0) > currentLimit.title
                                        ? 'text-red-500'
                                        : 'text-muted-foreground'
                                        }`}>
                                        {currentEditState?.title?.length || 0}/{currentLimit.title}
                                    </span>
                                )}
                            </label>
                            <input
                                type="text"
                                value={currentEditState?.title || ''}
                                onChange={(e) => handleContentChange(activePlatform, 'title', e.target.value)}
                                placeholder="Enter video title..."
                                className={`w-full px-4 py-3 rounded-xl border-2 transition-colors bg-muted/50 text-foreground placeholder-muted-foreground ${(currentEditState?.title?.length || 0) > (currentLimit.title || 100)
                                    ? 'border-red-500 focus:border-red-500'
                                    : 'focus:border-primary border-border'
                                    }`}
                            />
                        </div>
                    )}

                    {/* Main Content/Caption */}
                    <div className="space-y-2">
                        <label className="flex items-center justify-between text-sm font-semibold text-foreground">
                            <span>{currentLabels.main}</span>
                            <span className={`text-xs font-normal ${isOverLimit ? 'text-red-500 font-medium' : 'text-muted-foreground'
                                }`}>
                                {charCount}/{currentLimit.caption}
                            </span>
                        </label>
                        <div className="relative">
                            <textarea
                                value={currentEditState?.content || ''}
                                onChange={(e) => handleContentChange(activePlatform, 'content', e.target.value)}
                                placeholder={`Enter your ${currentLabels.main.toLowerCase()}...`}
                                rows={8}
                                className={`w-full px-4 py-3 rounded-xl border-2 transition-colors resize-none bg-muted/50 text-foreground placeholder-muted-foreground ${isOverLimit
                                    ? 'border-red-500 focus:border-red-500'
                                    : 'focus:border-primary border-border'
                                    }`}
                            />

                            {/* AI Improve Button */}
                            <div className="mt-2 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => handleImproveWithAI(activePlatform)}
                                    disabled={isImprovingWithAI || !currentEditState?.content}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:from-purple-700 hover:to-pink-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isImprovingWithAI ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Improving...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Improve with AI
                                        </>
                                    )}
                                </button>

                                {improvementError && (
                                    <span className="text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {improvementError}
                                    </span>
                                )}
                            </div>
                        </div>
                        {isOverLimit && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Content exceeds {activePlatform}'s character limit
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <footer className="p-5 border-t border-border bg-muted/30">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            {hasChanges && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Unsaved changes
                                </span>
                            )}
                            {saveSuccess && (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    Saved successfully!
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || isOverLimit || !hasChanges}
                                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : saveSuccess ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Saved!
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </footer>
            </div>

            {/* AI Improvement Instructions Modal */}
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
                                    <h3 className="text-lg font-bold text-foreground">Improve with AI</h3>
                                    <p className="text-xs text-muted-foreground">Tell AI what you want to improve</p>
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
                                <textarea
                                    value={improvementInstructions}
                                    onChange={(e) => setImprovementInstructions(e.target.value)}
                                    placeholder="Example: Make it more engaging, add emojis, make it shorter, focus on benefits, add urgency..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary transition-colors resize-none bg-muted/50 text-foreground placeholder-muted-foreground"
                                />
                            </div>

                            {/* AI Model Selection */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-foreground">AI Model</label>
                                <div className="relative inline-block">
                                    <button
                                        type="button"
                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                        className="px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 transition-colors bg-muted/50 text-foreground flex items-center gap-2 text-xs"
                                    >
                                        <span>{getModelDisplayName(selectedModelId)}</span>
                                        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showModelDropdown && (
                                        <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto whitespace-nowrap">
                                            {AI_MODELS.map((model) => (
                                                <button
                                                    key={model.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedModelId(model.id);
                                                        setShowModelDropdown(false);
                                                    }}
                                                    className={`w-full px-3 py-1.5 text-left hover:bg-muted transition-colors flex items-center gap-2 text-xs ${selectedModelId === model.id ? 'bg-primary/10' : ''
                                                        }`}
                                                >
                                                    <span className="text-foreground">{model.name} <span className="text-muted-foreground">({model.providerLabel})</span></span>
                                                    {selectedModelId === model.id && (
                                                        <Check className="w-3 h-3 text-primary" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Suggestions */}
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground">Quick suggestions:</p>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        'Make it more engaging',
                                        'Add emojis',
                                        'Make it shorter',
                                        'Add call-to-action',
                                        'More professional',
                                        'Add urgency'
                                    ].map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            onClick={() => setImprovementInstructions(suggestion)}
                                            className="px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    💡 <strong>Tip:</strong> Leave it empty for general improvements, or be specific about what you want to change.
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-muted/30">
                            <button
                                onClick={() => {
                                    setShowImprovementModal(false);
                                    setImprovementInstructions('');
                                }}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitImprovement}
                                disabled={isImprovingWithAI}
                                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Sparkles className="w-4 h-4" />
                                {isImprovingWithAI ? 'Improving...' : 'Improve Content'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EditPostModal;
