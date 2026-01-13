'use client';

import React, { useState, useRef } from 'react';
import { MediaGallery } from '../media-studio/components/MediaGallery';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FolderOpen,
  Zap,
  Upload,
  CheckSquare,
  Search,
  X,
  Heart,
  Music,
  RefreshCw,
  Grid,
  List,
  Loader2,
  Layers,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMedia, MediaItem } from '@/contexts/MediaContext';
import toast from 'react-hot-toast';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'images' | 'videos' | 'audio' | 'favorites';

export default function LibraryPage() {
  const { workspaceId, user } = useAuth();

  // State for toolbar controls
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<MediaItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Media context
  const {
    mediaItems,
    loading: isLoading,
    refreshMedia: fetchMediaFromDb,
    setFilters,
  } = useMedia();

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !workspaceId) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');

        if (!isImage && !isVideo && !isAudio) {
          throw new Error(`Invalid file type: ${file.name}`);
        }

        const maxSize = isVideo ? 2 * 1024 * 1024 * 1024 : isAudio ? 20 * 1024 * 1024 : 50 * 1024 * 1024;
        if (file.size > maxSize) {
          throw new Error(`File too large: ${file.name}`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'media-library');
        formData.append('tags', `workspace:${workspaceId},uploaded`);

        if (isVideo && file.size > 100 * 1024 * 1024) {
          formData.append('chunked', 'true');
        }

        const uploadEndpoint = isImage
          ? '/api/cloudinary/upload/image'
          : isVideo
            ? '/api/cloudinary/upload/video'
            : '/api/cloudinary/upload/audio';

        // Use the Next.js proxy path (proxied to Python backend)
        const uploadResponse = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.detail || 'Failed to upload');
        }

        const uploadResult = await uploadResponse.json();
        const fileUrl = uploadResult.secure_url;

        const mediaResponse = await fetch('/api/media-studio/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            mediaItem: {
              type: isImage ? 'image' : isVideo ? 'video' : 'audio',
              source: 'uploaded',
              url: fileUrl,
              prompt: file.name.replace(/\.[^/.]+$/, ''),
              model: 'cloudinary',
              config: {
                originalFileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                cloudinaryPublicId: uploadResult.public_id,
              },
            },
          }),
        });

        if (!mediaResponse.ok) {
          throw new Error('Failed to save to library');
        }
      }

      await fetchMediaFromDb();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast.success('Upload complete!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // Cancel selection mode
  const cancelSelectMode = () => {
    setIsSelectMode(false);
    setSelectedItems([]);
  };

  // Total items count
  const totalItems = mediaItems.length;

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header with Toolbar */}
      <div className="sticky top-0 z-20 border-b bg-canva-gradient/95 backdrop-blur-sm shadow-sm">
        <div className="relative px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Left: Logo and Title */}
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-xl">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>

              <div>
                <h1 className="text-lg font-bold text-foreground flex items-center gap-3">
                  Media Assets
                  <Badge variant="secondary" className="px-2 py-0.5 h-6">
                    All Media
                  </Badge>
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Browse and manage all your generated images and videos
                </p>
              </div>
            </div>

            {/* Right: Toolbar Controls */}
            <div className="flex flex-wrap gap-2.5 items-center">
              {/* Upload Button */}
              {workspaceId && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="media-upload-header"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isSelectMode}
                    size="sm"
                    className="h-9 px-4 text-[13px] bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-lg"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </>
              )}

              {/* Select Mode */}
              {workspaceId && totalItems > 1 && (
                isSelectMode ? (
                  <div className="flex items-center gap-2.5">
                    <Badge variant="secondary" className="h-6 px-2.5 text-[11px]">
                      {selectedItems.length} selected
                    </Badge>
                    {selectedItems.length >= 2 && (
                      <>
                        <Button
                          onClick={() => {
                            // Open carousel post modal - handled by MediaGallery
                            const event = new CustomEvent('createCarouselPost', { detail: selectedItems });
                            window.dispatchEvent(event);
                          }}
                          size="sm"
                          className="h-9 px-4 text-[13px] bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg"
                        >
                          <Layers className="w-4 h-4 mr-1.5" />
                          Carousel Post
                        </Button>
                        <Button
                          onClick={() => {
                            // Open carousel ad modal - handled by MediaGallery
                            const event = new CustomEvent('createCarouselAd', { detail: selectedItems });
                            window.dispatchEvent(event);
                          }}
                          size="sm"
                          className="h-9 px-4 text-[13px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg"
                        >
                          <Megaphone className="w-4 h-4 mr-1.5" />
                          Carousel Ad
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={cancelSelectMode}
                      variant="outline"
                      size="sm"
                      className="h-9 px-3.5 text-[13px] rounded-lg"
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setIsSelectMode(true)}
                    variant="outline"
                    size="sm"
                    className="h-9 px-3.5 text-[13px] rounded-lg"
                  >
                    <CheckSquare className="w-4 h-4 mr-1.5" />
                    Select
                  </Button>
                )
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by prompt..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 w-[200px] text-[13px] rounded-lg"
                />
                {searchQuery && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1.5 p-1.5 bg-muted/50 rounded-xl">
                {(['all', 'images', 'videos', 'audio', 'favorites'] as FilterType[]).map((type) => (
                  <button
                    key={type}
                    className={`px-3 py-1.5 rounded-lg text-[12px] capitalize transition-colors flex items-center gap-1.5 ${filterType === type
                      ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    onClick={() => setFilterType(type)}
                  >
                    {type === 'favorites' && <Heart className="w-3.5 h-3.5" />}
                    {type === 'audio' && <Music className="w-3.5 h-3.5" />}
                    {type}
                  </button>
                ))}
              </div>

              {/* Refresh */}
              {workspaceId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchMediaFromDb}
                  disabled={isLoading}
                  className="h-9 w-9 p-0 rounded-lg"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}

              {/* View Mode Toggle */}
              <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl">
                <button
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        <MediaGallery
          images={[]}
          videos={[]}
          workspaceId={workspaceId || undefined}
          hideHeader={true}
          externalViewMode={viewMode}
          externalFilterType={filterType}
          externalSearchQuery={searchQuery}
          externalIsSelectMode={isSelectMode}
          externalSelectedItems={selectedItems}
          onSelectedItemsChange={setSelectedItems}
          onSelectModeChange={setIsSelectMode}
        />
      </div>
    </div>
  );
}
