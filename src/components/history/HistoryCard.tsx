'use client'

import React, { useState } from 'react';
import { Post, Platform, MediaAsset, PostType } from '@/types';
import { PLATFORMS, STATUS_CONFIG } from '@/constants';
import { Link as LinkIcon, Globe, Send, Clock, X, Trash2, Loader2, AlertCircle, CheckCircle2, Film, Image as ImageIcon, Layers, FileText, BookImage, Edit3 } from 'lucide-react';
import { PlatformTemplateRenderer } from '@/components/templates/PlatformTemplateRenderer';
import { usePermissions } from '@/hooks/usePermissions';
import { getFormatBadge } from '@/utils/platformMediaConfig';
import { EditPostModal } from './EditPostModal';

interface PublishedCardProps {
    post: Post;
    onUpdatePost: (post: Post) => void;
    onDeletePost: (postId: string, postTitle?: string) => void;
    onPublishPost?: (post: Post) => Promise<void>;
    connectedAccounts: Record<Platform, boolean>;
}

const PublishedCard: React.FC<PublishedCardProps> = ({ post, onUpdatePost, onDeletePost, onPublishPost, connectedAccounts }) => {
    const { isViewOnly } = usePermissions();
    const [activePlatform, setActivePlatform] = useState<Platform>(post.platforms[0]);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [publishSuccess, setPublishSuccess] = useState(false);
    const [mediaPreview, setMediaPreview] = useState<{ type: 'image' | 'video'; url: string } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const handlePublish = async () => {
        if (!onPublishPost) return;

        setIsPublishing(true);
        setPublishError(null);
        setPublishSuccess(false);

        try {
            // Use the callback from App.tsx to publish
            await onPublishPost(post);
            setPublishSuccess(true);

            // Auto-hide success message after 3 seconds
            setTimeout(() => setPublishSuccess(false), 3000);
        } catch (error) {
            setPublishError(error instanceof Error ? error.message : 'An unexpected error occurred while publishing');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleSchedule = async () => {
        if (!scheduleDate) return;
        const scheduledAt = new Date(scheduleDate).toISOString();
        const updates: Partial<Post> = {
            status: 'scheduled',
            scheduledAt
        };
        onUpdatePost({ ...post, ...updates });

        // Activity is automatically logged by the Python backend

        setIsScheduleModalOpen(false);
        setScheduleDate('');
    };

    const handleUnschedule = () => {
        const updates: Partial<Post> = {
            status: 'ready_to_publish',
            scheduledAt: undefined
        };
        onUpdatePost({ ...post, ...updates });
    };

    const unconnectedPlatforms = post.platforms.filter(p => !connectedAccounts[p]);
    const canPublish = unconnectedPlatforms.length === 0;

    const StatusChip: React.FC<{ status: Post['status'] }> = ({ status }) => {
        const config = STATUS_CONFIG[status];
        const statusColors: Partial<Record<Post['status'], string>> = {
            'ready_to_publish': 'bg-cyan-100 text-cyan-800 border-cyan-200',
            'scheduled': 'bg-blue-100 text-blue-800 border-blue-200',
            'published': 'bg-green-100 text-green-800 border-green-200',
            'failed': 'bg-red-100 text-red-800 border-red-200'
        };
        const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
        return <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${colorClass}`}>{config?.label || status}</span>;
    };

    const ActionButton: React.FC<{ onClick: () => void, icon: React.ElementType, label: string, className?: string, disabled?: boolean }> =
        ({ onClick, icon: Icon, label, className, disabled }) => (
            <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center text-xs font-semibold py-1 px-2.5 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
                <Icon className={`w-3.5 h-3.5 ${label ? 'mr-1.5' : ''} ${Icon === Loader2 ? 'animate-spin' : ''}`} />
                {label && <span className="whitespace-nowrap text-xs">{label}</span>}
            </button>
        );

    const MediaPreviewModal = () => {
        if (!mediaPreview) return null;

        return (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setMediaPreview(null)}>
                <div className="relative max-w-7xl max-h-[90vh] w-full flex flex-col" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => setMediaPreview(null)}
                        className="absolute -top-12 right-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    {mediaPreview.type === 'image' ? (
                        <img
                            src={mediaPreview.url}
                            alt="Preview"
                            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl mx-auto"
                        />
                    ) : (
                        <video
                            src={mediaPreview.url}
                            controls
                            autoPlay
                            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl mx-auto"
                        />
                    )}
                </div>
            </div>
        );
    };

    const ScheduleModal = () => (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsScheduleModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Schedule Post</h2>
                    <button onClick={() => setIsScheduleModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </header>
                <div className="p-6 space-y-4">
                    <p className="text-gray-700">Select a date and time to schedule this post for.</p>
                    <input
                        type="datetime-local"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="mt-1 block w-full bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 p-3"
                        min={new Date().toISOString().slice(0, 16)}
                    />
                    <button
                        onClick={handleSchedule}
                        disabled={!scheduleDate}
                        className="w-full inline-flex justify-center items-center py-3 px-4 shadow-md text-base font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                    >
                        Confirm Schedule
                    </button>
                </div>
            </div>
        </div>
    );

    const isVideoUrl = (url: string): boolean => {
        return !!(url?.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/i) ||
            url?.includes('video') ||
            url?.startsWith('data:video/'));
    };

    const PlatformPreview: React.FC<{ platform: Platform }> = ({ platform }) => {
        // Build media array from post properties
        const media: MediaAsset[] = [];

        // Add carousel images/videos if available
        if (post.carouselImages && post.carouselImages.length > 0) {
            post.carouselImages.forEach((url, index) => {
                const isVideo = isVideoUrl(url);
                media.push({
                    id: `carousel-${index}-${Date.now()}`,
                    name: `Carousel Slide ${index + 1}`,
                    type: isVideo ? 'video' as const : 'image' as const,
                    url: url,
                    size: 0,
                    tags: ['carousel'],
                    createdAt: new Date().toISOString(),
                    source: 'ai-generated' as const,
                    usedInPosts: [post.id]
                });
            });
        } else if (post.generatedImage) {
            // Fallback to single image if no carousel
            media.push({
                id: `image-${Date.now()}`,
                name: 'Generated Image',
                type: 'image' as const,
                url: post.generatedImage,
                size: 0,
                tags: [],
                createdAt: new Date().toISOString(),
                source: 'ai-generated' as const,
                usedInPosts: [post.id]
            });
        }

        if (post.generatedVideoUrl) {
            media.push({
                id: `video-${Date.now()}`,
                name: 'Generated Video',
                type: 'video' as const,
                url: post.generatedVideoUrl,
                size: 0,
                tags: [],
                createdAt: new Date().toISOString(),
                source: 'ai-generated' as const,
                usedInPosts: [post.id]
            });
        }

        // Get post type badge info
        const mediaType = post.generatedVideoUrl ? 'video' : 'image';
        const formatBadge = getFormatBadge(mediaType as 'video' | 'image', post.postType || 'post');

        // Get platform info for icon
        const platformInfo = PLATFORMS.find(p => p.id === platform);
        const PlatformIcon = platformInfo?.icon;

        // Get platform-specific colors
        const platformColors: Record<Platform, string> = {
            instagram: 'bg-gradient-to-r from-purple-600 to-pink-500',
            facebook: 'bg-[#1877F2]',
            twitter: 'bg-black',
            linkedin: 'bg-[#0A66C2]',
            tiktok: 'bg-black',
            youtube: 'bg-[#FF0000]'
        };

        // Get post type icon
        const getPostTypeIcon = () => {
            switch (post.postType) {
                case 'story': return <Film className="w-3 h-3" />;
                case 'reel': return <Film className="w-3 h-3" />;
                case 'carousel': return <Layers className="w-3 h-3" />;
                default: return post.generatedVideoUrl ? <Film className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />;
            }
        };

        // Get post type label
        const getPostTypeLabel = () => {
            if (post.postType === 'story') return 'STORY';
            if (post.postType === 'reel') return 'REEL';
            if (post.postType === 'carousel' || (post.carouselImages && post.carouselImages.length > 1)) return 'CAROUSEL';
            if (post.generatedVideoUrl) return 'VIDEO';
            return 'POST';
        };

        return (
            <div className="flex flex-col w-full">
                {/* Platform Icon & Post Type Badge */}
                <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-1.5">
                        {/* Platform Icon */}
                        {PlatformIcon && (
                            <div className={`${platformColors[platform]} p-1.5 rounded-full`}>
                                <PlatformIcon className="w-4 h-4 text-white" />
                            </div>
                        )}
                        {/* Post Type Badge */}
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 text-white ${platformColors[platform]}`}>
                            {getPostTypeIcon()}
                            {getPostTypeLabel()}
                        </span>
                    </div>
                    {post.carouselImages && post.carouselImages.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                            {post.carouselImages.length} slides
                        </span>
                    )}
                </div>
                <div className="flex justify-center w-full">
                    <PlatformTemplateRenderer
                        post={post}
                        platform={platform}
                        postType={post.postType || 'post'}
                        media={media}
                        mode="preview"
                    />
                </div>
            </div>
        );
    };

    const PlatformSwitcher = () => (
        <div className="flex items-center gap-1 mb-3 p-0.5 bg-gray-800 rounded-lg">
            {post.platforms.map(p => {
                const platformInfo = PLATFORMS.find(info => info.id === p);
                if (!platformInfo) return null;
                const { icon: Icon } = platformInfo;
                return (
                    <button
                        key={p}
                        onClick={() => setActivePlatform(p)}
                        title={`Preview on ${platformInfo.name}`}
                        className={`flex-1 flex justify-center items-center p-1.5 rounded-md transition-all ${activePlatform === p ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-700'}`}
                    > <Icon className="w-4 h-4" /> </button>
                );
            })}
        </div>
    );

    const PreviewModal = () => {
        if (!isPreviewOpen) return null;

        // Build media array from post properties
        const media: MediaAsset[] = [];

        if (post.carouselImages && post.carouselImages.length > 0) {
            post.carouselImages.forEach((url, index) => {
                const isVideo = isVideoUrl(url);
                media.push({
                    id: `carousel-${index}-${Date.now()}`,
                    name: `Carousel Slide ${index + 1}`,
                    type: isVideo ? 'video' as const : 'image' as const,
                    url: url,
                    size: 0,
                    tags: ['carousel'],
                    createdAt: new Date().toISOString(),
                    source: 'ai-generated' as const,
                    usedInPosts: [post.id]
                });
            });
        } else if (post.generatedImage) {
            media.push({
                id: `image-${Date.now()}`,
                name: 'Generated Image',
                type: 'image' as const,
                url: post.generatedImage,
                size: 0,
                tags: [],
                createdAt: new Date().toISOString(),
                source: 'ai-generated' as const,
                usedInPosts: [post.id]
            });
        }

        if (post.generatedVideoUrl) {
            media.push({
                id: `video-${Date.now()}`,
                name: 'Generated Video',
                type: 'video' as const,
                url: post.generatedVideoUrl,
                size: 0,
                tags: [],
                createdAt: new Date().toISOString(),
                source: 'ai-generated' as const,
                usedInPosts: [post.id]
            });
        }

        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 animate-fade-in" onClick={() => setIsPreviewOpen(false)}>
                <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-hide scroll-smooth" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-center">
                        <PlatformTemplateRenderer
                            post={post}
                            platform={activePlatform}
                            postType={post.postType || 'post'}
                            media={media}
                            mode="preview"
                        />
                    </div>
                </div>
                <style>{`
                    @keyframes fade-in {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    .animate-fade-in {
                        animation: fade-in 0.2s ease-out forwards;
                    }
                `}</style>
            </div>
        );
    };

    const renderActions = () => {
        switch (post.status) {
            case 'ready_to_publish':
                return (
                    <div className="flex flex-col w-full gap-2">
                        <div className="flex items-center justify-between w-full gap-2">
                            <div className="flex gap-1.5 items-center flex-wrap">
                                <ActionButton
                                    onClick={() => !isViewOnly && setIsEditModalOpen(true)}
                                    disabled={isViewOnly}
                                    icon={Edit3}
                                    label="Edit"
                                    className={`text-white shadow-md ${isViewOnly ? 'bg-emerald-600/50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                />
                                <ActionButton
                                    onClick={() => !isViewOnly && setIsScheduleModalOpen(true)}
                                    disabled={isViewOnly}
                                    icon={Clock}
                                    label="Schedule"
                                    className={`text-white shadow-md ${isViewOnly ? 'bg-purple-600/50 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                                />
                                <ActionButton
                                    onClick={() => !isViewOnly && handlePublish()}
                                    disabled={!canPublish || isPublishing || isViewOnly}
                                    icon={isPublishing ? Loader2 : Send}
                                    label={isPublishing ? 'Publishing...' : 'Publish Now'}
                                    className={`text-white shadow-md ${isViewOnly ? 'bg-indigo-600/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                />
                                {!canPublish && !isViewOnly && (
                                    <div className="text-xs text-yellow-400 flex items-center gap-1">
                                        <LinkIcon className="w-3 h-3 flex-shrink-0" />
                                        <span>Connect {unconnectedPlatforms.map(p => PLATFORMS.find(info => info.id === p)?.name).join(', ')} account(s) to publish.</span>
                                    </div>
                                )}
                            </div>
                            <ActionButton
                                onClick={() => !isViewOnly && onDeletePost(post.id, post.topic)}
                                disabled={isViewOnly}
                                icon={Trash2}
                                label=""
                                className={`text-white w-7 h-7 shadow-md ${isViewOnly ? 'bg-red-600/50 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                            />
                        </div>
                        {isViewOnly && (
                            <div className="text-xs text-muted-foreground">View only mode</div>
                        )}
                        {publishError && (
                            <div className="text-xs text-red-800 bg-red-50 border border-red-200 p-2 rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{publishError}</span>
                            </div>
                        )}
                        {publishSuccess && (
                            <div className="text-xs text-green-800 bg-green-50 border border-green-200 p-2 rounded-lg flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Successfully published to all platforms! 🎉</span>
                            </div>
                        )}
                    </div>
                );
            case 'scheduled':
                return (
                    <div className="flex items-center justify-between w-full text-xs">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="font-medium">{new Date(post.scheduledAt!).toLocaleString()}</span>
                            </div>
                            <button
                                onClick={() => !isViewOnly && setIsEditModalOpen(true)}
                                disabled={isViewOnly}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${isViewOnly
                                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                                        : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                    }`}
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span className="font-medium">Edit</span>
                            </button>
                        </div>
                        <button
                            onClick={() => !isViewOnly && handleUnschedule()}
                            disabled={isViewOnly}
                            className={`text-xs ${isViewOnly ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:text-gray-900 hover:underline'}`}
                        >
                            Unschedule
                        </button>
                    </div>
                );
            case 'published':
                return (
                    <div className="flex items-center justify-between w-full text-xs">
                        <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2.5 py-1.5 rounded-lg">
                            <Globe className="w-3.5 h-3.5" />
                            <span className="font-medium">{new Date(post.publishedAt!).toLocaleString()}</span>
                        </div>
                        <a href="#" className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline">View Live Post</a>
                    </div>
                );
            case 'failed':
                // Get error from content._publishLog if available
                const publishLog = (post.content as any)?._publishLog;
                const errorMessage = publishLog?.error || (post as any).publish_error || 'Publishing failed';
                const retryCount = publishLog?.retryCount || (post as any).publish_retry_count || 0;

                return (
                    <div className="flex flex-col w-full gap-2">
                        {/* Error Message */}
                        <div className="text-xs text-red-800 bg-red-50 border border-red-200 p-2.5 rounded-lg">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-semibold">Publishing Failed</p>
                                    <p className="text-red-600 mt-0.5">{errorMessage}</p>
                                    {retryCount > 0 && (
                                        <p className="text-red-500 mt-1 text-[10px]">
                                            Attempted {retryCount} time{retryCount > 1 ? 's' : ''}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1.5">
                                <ActionButton
                                    onClick={() => !isViewOnly && setIsEditModalOpen(true)}
                                    disabled={isViewOnly}
                                    icon={Edit3}
                                    label="Edit"
                                    className={`text-white shadow-md ${isViewOnly ? 'bg-emerald-600/50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                />
                                <ActionButton
                                    onClick={() => {
                                        if (isViewOnly) return;
                                        // Retry: Reset to scheduled status
                                        const updates: Partial<Post> = {
                                            status: 'scheduled',
                                            scheduledAt: new Date().toISOString() // Schedule for now (immediate retry)
                                        };
                                        onUpdatePost({ ...post, ...updates });
                                    }}
                                    disabled={isViewOnly}
                                    icon={Clock}
                                    label="Retry Now"
                                    className={`text-white shadow-md ${isViewOnly ? 'bg-orange-600/50 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}
                                />
                                <ActionButton
                                    onClick={() => !isViewOnly && handlePublish()}
                                    disabled={!canPublish || isPublishing || isViewOnly}
                                    icon={isPublishing ? Loader2 : Send}
                                    label="Publish Now"
                                    className={`text-white shadow-md ${isViewOnly ? 'bg-indigo-600/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                />
                            </div>
                            <ActionButton
                                onClick={() => !isViewOnly && onDeletePost(post.id, post.topic)}
                                disabled={isViewOnly}
                                icon={Trash2}
                                label=""
                                className={`text-white w-7 h-7 shadow-md ${isViewOnly ? 'bg-red-600/50 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                            />
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <>
            <div className="bg-transparent rounded-lg shadow-md hover:shadow-lg flex flex-col overflow-hidden border border-border transition-all">
                <div className="flex-grow p-2 cursor-pointer" onClick={() => setIsPreviewOpen(true)}>
                    <PlatformPreview platform={activePlatform} />
                </div>
                <div className="p-2 bg-muted/50 flex flex-wrap gap-1.5 justify-between items-center border-t border-border">
                    {renderActions()}
                </div>
            </div>
            <MediaPreviewModal />
            <PreviewModal />
            {isScheduleModalOpen && <ScheduleModal />}
            {isEditModalOpen && (
                <EditPostModal
                    post={post}
                    onSave={(updatedPost) => {
                        onUpdatePost(updatedPost);
                        setIsEditModalOpen(false);
                    }}
                    onClose={() => setIsEditModalOpen(false)}
                />
            )}
        </>
    );
};

export default PublishedCard;