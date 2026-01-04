'use client';

import React, { useState, useEffect } from 'react';
import {
    Image,
    Video,
    Upload,
    Search,
    Grid3x3,
    List,
    Eye,
    BarChart3,
    Loader2,
    Plus,
    ExternalLink,
    Filter,
    AlertCircle,
    CheckCircle2,
    TrendingUp,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import MediaLibraryPicker, { SelectedMedia } from './MediaLibraryPicker';
import { FolderOpen } from 'lucide-react';

interface CreativeAsset {
    id: string;
    name: string;
    hash: string;
    url: string;
    width?: number;
    height?: number;
    created_time?: string;
    status?: string;
}

interface AdLibraryResult {
    id: string;
    page_id: string;
    page_name: string;
    ad_creative_bodies: string[];
    ad_creative_link_titles: string[];
    ad_snapshot_url?: string;
    ad_delivery_start_time?: string;
}

interface CreativeHubProps {
    onRefresh?: () => void;
}

export default function CreativeHub({ onRefresh }: CreativeHubProps) {
    const [activeTab, setActiveTab] = useState('library');
    const [assets, setAssets] = useState<CreativeAsset[]>([]);
    const [adLibraryResults, setAdLibraryResults] = useState<AdLibraryResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadUrl, setUploadUrl] = useState('');
    const [uploadName, setUploadName] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);


    useEffect(() => {
        fetchAssets();
    }, []);

    const fetchAssets = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/v1/meta-ads/creative/library');
            if (response.ok) {
                const data = await response.json();
                setAssets(data.assets || []);
            }
        } catch (err) {
            console.error('Failed to fetch assets:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadFile(file);
            setUploadName(file.name.replace(/\.[^/.]+$/, ''));
            // Create preview
            const reader = new FileReader();
            reader.onload = (event) => {
                setUploadPreview(event.target?.result as string);
                setUploadUrl(''); // Clear URL when file is selected
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpload = async () => {
        if (!uploadUrl && !uploadFile) return;

        setIsUploading(true);
        setError(null);

        try {
            let imageUrl = uploadUrl;

            // If we have a file, convert to base64 data URL
            if (uploadFile && uploadPreview) {
                imageUrl = uploadPreview;
            }

            const response = await fetch('/api/v1/meta-ads/creative/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: uploadName || 'Uploaded Image',
                    image_url: imageUrl
                }),
            });

            if (response.ok) {
                setShowUploadModal(false);
                setUploadUrl('');
                setUploadName('');
                setUploadFile(null);
                setUploadPreview(null);
                fetchAssets();
                onRefresh?.();
            } else {
                const data = await response.json();
                setError(data.detail || data.error || 'Upload failed');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const clearUpload = () => {
        setUploadUrl('');
        setUploadName('');
        setUploadFile(null);
        setUploadPreview(null);
    };

    const handleMediaSelect = (media: SelectedMedia | SelectedMedia[]) => {
        const selected = Array.isArray(media) ? media[0] : media;
        if (selected) {
            setUploadUrl(selected.url);
            setUploadName(selected.url.split('/').pop() || 'Library Image');
            setUploadFile(null);
            setUploadPreview(null);
        }
    };


    const [adLibraryError, setAdLibraryError] = useState<string | null>(null);

    const searchAdLibrary = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setAdLibraryError(null);
        try {
            const response = await fetch(
                `/api/v1/meta-ads/adlibrary/search?search_terms=${encodeURIComponent(searchQuery)}&limit=25`
            );
            const data = await response.json();

            if (response.ok && data.success) {
                setAdLibraryResults(data.results || []);
            } else {
                // Show error from API
                setAdLibraryError(data.error || data.detail || 'Search failed');
                setAdLibraryResults([]);
            }
        } catch (err) {
            console.error('Failed to search ad library:', err);
            setAdLibraryError('Network error. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Image className="w-6 h-6 text-pink-500" />
                        Creative Hub
                    </h2>
                    <p className="text-muted-foreground">Manage creative assets and research competitors</p>
                </div>
                <Button
                    onClick={() => setShowUploadModal(true)}
                    className="gap-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700"
                >
                    <Upload className="w-4 h-4" />
                    Upload Creative
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="library" className="gap-2">
                        <Image className="w-4 h-4" />
                        Creative Library
                    </TabsTrigger>
                    <TabsTrigger value="research" className="gap-2">
                        <Search className="w-4 h-4" />
                        Ad Library
                    </TabsTrigger>
                </TabsList>

                {/* Library Tab */}
                <TabsContent value="library" className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Button
                                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                            >
                                <Grid3x3 className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                            >
                                <List className="w-4 h-4" />
                            </Button>
                        </div>
                        <span className="text-sm text-muted-foreground">
                            {assets.length} assets
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : assets.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Image className="w-12 h-12 text-muted-foreground mb-4" />
                                <h3 className="font-semibold text-lg mb-2">No Creatives Yet</h3>
                                <p className="text-muted-foreground text-center max-w-md mb-4">
                                    Upload images and videos to use in your ads.
                                </p>
                                <Button onClick={() => setShowUploadModal(true)} className="gap-2">
                                    <Upload className="w-4 h-4" />
                                    Upload Your First Creative
                                </Button>
                            </CardContent>
                        </Card>
                    ) : viewMode === 'grid' ? (
                        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {assets.map((asset) => (
                                <Card key={asset.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="aspect-square bg-muted relative">
                                        <img
                                            src={asset.url}
                                            alt={asset.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                                            }}
                                        />
                                    </div>
                                    <CardContent className="p-3">
                                        <p className="font-medium text-sm truncate">{asset.name || 'Untitled'}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {asset.width && asset.height ? `${asset.width}×${asset.height}` : 'Image'}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {assets.map((asset) => (
                                <Card key={asset.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-3 flex items-center gap-4">
                                        <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                                            <img
                                                src={asset.url}
                                                alt={asset.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{asset.name || 'Untitled'}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {asset.width && asset.height ? `${asset.width}×${asset.height}` : 'Image'}
                                                {asset.hash && ` • ${asset.hash.substring(0, 8)}...`}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="sm">
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Ad Library Research Tab */}
                <TabsContent value="research" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Meta Ad Library Research</CardTitle>
                            <CardDescription>Search competitor ads for inspiration</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search by keyword, brand, or page..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && searchAdLibrary()}
                                    className="flex-1"
                                />
                                <Button onClick={searchAdLibrary} disabled={isSearching}>
                                    {isSearching ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Search className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>

                            {/* Error Display */}
                            {adLibraryError && (
                                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="font-medium text-amber-800 dark:text-amber-200">Ad Library API Access Required</p>
                                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                            {adLibraryError}
                                        </p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                            To use this feature, your Meta App needs "Ads Library API" access.
                                            Apply at <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Meta Developer Console</a>.
                                        </p>
                                    </div>
                                </div>
                            )}


                            {adLibraryResults.length > 0 && (
                                <div className="space-y-3 mt-4">
                                    {adLibraryResults.map((ad) => (
                                        <Card key={ad.id}>
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold">{ad.page_name}</p>
                                                        {ad.ad_creative_bodies?.[0] && (
                                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                                                {ad.ad_creative_bodies[0]}
                                                            </p>
                                                        )}
                                                        {ad.ad_creative_link_titles?.[0] && (
                                                            <p className="text-sm font-medium mt-2">
                                                                {ad.ad_creative_link_titles[0]}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {ad.ad_snapshot_url && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => window.open(ad.ad_snapshot_url, '_blank')}
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Upload className="w-5 h-5 text-pink-500" />
                                Upload Creative to Meta
                            </CardTitle>
                            <CardDescription>
                                Upload from your computer, media library, or paste an image URL
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Image Preview */}
                            {(uploadPreview || uploadUrl) && (
                                <div className="relative rounded-lg overflow-hidden border bg-muted aspect-video">
                                    <img
                                        src={uploadPreview || uploadUrl}
                                        alt="Preview"
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                                        }}
                                    />
                                    <button
                                        onClick={clearUpload}
                                        className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-full"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                                        {uploadFile ? 'From Computer' : 'From URL'}
                                    </div>
                                </div>
                            )}

                            {/* Upload Options */}
                            {!uploadPreview && !uploadUrl && (
                                <div className="grid grid-cols-2 gap-3">
                                    {/* File Upload */}
                                    <label className="border-2 border-dashed rounded-xl p-4 text-center hover:border-pink-400 transition-colors cursor-pointer">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-sm font-medium">Upload File</p>
                                        <p className="text-xs text-muted-foreground">
                                            From computer
                                        </p>
                                    </label>

                                    {/* Media Library */}
                                    <div
                                        className="border-2 border-dashed rounded-xl p-4 text-center hover:border-pink-400 transition-colors cursor-pointer"
                                        onClick={() => setMediaPickerOpen(true)}
                                    >
                                        <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-sm font-medium">Media Library</p>
                                        <p className="text-xs text-muted-foreground">
                                            Generated images
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">or paste URL</span>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="name">Name (optional)</Label>
                                <Input
                                    id="name"
                                    value={uploadName}
                                    onChange={(e) => setUploadName(e.target.value)}
                                    placeholder="My Creative"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="url">Image URL</Label>
                                <Input
                                    id="url"
                                    value={uploadUrl}
                                    onChange={(e) => {
                                        setUploadUrl(e.target.value);
                                        setUploadFile(null);
                                        setUploadPreview(null);
                                    }}
                                    placeholder="https://example.com/image.jpg"
                                    className="mt-1"
                                />
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/20">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-sm">{error}</span>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => {
                                setShowUploadModal(false);
                                clearUpload();
                                setError(null);
                            }}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={isUploading || (!uploadUrl && !uploadFile)}
                                className="bg-gradient-to-r from-pink-500 to-rose-600"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Uploading to Meta...
                                    </>
                                ) : (
                                    'Upload to Meta'
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}


            {/* Media Library Picker */}
            <MediaLibraryPicker
                open={mediaPickerOpen}
                onOpenChange={setMediaPickerOpen}
                onSelect={handleMediaSelect}
                mediaType="image"
                multiple={false}
                title="Select Image for Meta Ads"
                description="Choose an image from your library to upload to Meta's creative library"
            />
        </div>
    );
}
