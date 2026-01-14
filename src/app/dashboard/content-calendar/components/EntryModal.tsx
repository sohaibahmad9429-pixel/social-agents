'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, Save, Image, Video, Hash, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { CalendarEntry, Platform, ContentType, EntryStatus } from '../types';

interface EntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: CalendarEntry | null;
    onSave: () => void;
}

const PLATFORMS: Platform[] = ['instagram', 'linkedin', 'twitter', 'tiktok', 'youtube', 'facebook'];
const CONTENT_TYPES: ContentType[] = [
    'educational', 'fun', 'inspirational', 'promotional',
    'interactive', 'brand_related', 'evergreen', 'holiday_themed'
];
const STATUSES: EntryStatus[] = ['draft', 'scheduled', 'published', 'archived'];

const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
    educational: '#1E3A8A',
    fun: '#059669',
    inspirational: '#D97706',
    promotional: '#DC2626',
    interactive: '#7C3AED',
    brand_related: '#0891B2',
    evergreen: '#65A30D',
    holiday_themed: '#BE185D',
};

export function EntryModal({ isOpen, onClose, entry, onSave }: EntryModalProps) {
    const { session } = useAuth();
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState('content');

    const [formData, setFormData] = useState({
        scheduled_date: '',
        scheduled_time: '',
        platform: 'instagram' as Platform,
        content_type: 'educational' as ContentType,
        title: '',
        content: '',
        hashtags: '',
        image_prompt: '',
        video_script: '',
        notes: '',
        status: 'scheduled' as EntryStatus,
    });

    useEffect(() => {
        if (entry) {
            setFormData({
                scheduled_date: entry.scheduled_date,
                scheduled_time: entry.scheduled_time || '',
                platform: entry.platform,
                content_type: entry.content_type,
                title: entry.title,
                content: entry.content || '',
                hashtags: entry.hashtags?.join(', ') || '',
                image_prompt: entry.image_prompt || '',
                video_script: entry.video_script || '',
                notes: entry.notes || '',
                status: entry.status,
            });
        } else {
            // New entry - default to today
            const today = new Date().toISOString().split('T')[0];
            setFormData({
                scheduled_date: today,
                scheduled_time: '09:00',
                platform: 'instagram',
                content_type: 'educational',
                title: '',
                content: '',
                hashtags: '',
                image_prompt: '',
                video_script: '',
                notes: '',
                status: 'scheduled',
            });
        }
    }, [entry, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session?.access_token) return;

        setLoading(true);
        try {
            const payload = {
                ...formData,
                hashtags: formData.hashtags ? formData.hashtags.split(',').map(h => h.trim()) : null,
                scheduled_time: formData.scheduled_time || null,
            };

            const url = entry
                ? `/api/calendar/${entry.id}`
                : `/api/calendar`;

            const response = await fetch(url, {
                method: entry ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                onSave();
            }
        } catch (error) {
            console.error('Error saving entry:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!entry || !session?.access_token) return;

        if (!confirm('Are you sure you want to delete this entry?')) return;

        setDeleting(true);
        try {
            const response = await fetch(
                `/api/calendar/${entry.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                }
            );

            if (response.ok) {
                onSave();
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {entry ? 'Edit Calendar Entry' : 'New Calendar Entry'}
                        {formData.content_type && (
                            <Badge
                                style={{ backgroundColor: CONTENT_TYPE_COLORS[formData.content_type] }}
                                className="text-white"
                            >
                                {formData.content_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                            <Label>Date *</Label>
                            <Input
                                type="date"
                                value={formData.scheduled_date}
                                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Time</Label>
                            <Input
                                type="time"
                                value={formData.scheduled_time}
                                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="space-y-2">
                            <Label>Platform *</Label>
                            <Select
                                value={formData.platform}
                                onValueChange={(v) => setFormData({ ...formData, platform: v as Platform })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLATFORMS.map((p) => (
                                        <SelectItem key={p} value={p}>
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Content Type *</Label>
                            <Select
                                value={formData.content_type}
                                onValueChange={(v) => setFormData({ ...formData, content_type: v as ContentType })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CONTENT_TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: CONTENT_TYPE_COLORS[t] }}
                                                />
                                                {t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(v) => setFormData({ ...formData, status: v as EntryStatus })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUSES.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2 mb-4">
                        <Label>Title *</Label>
                        <Input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Brief title for the content"
                            required
                            maxLength={200}
                        />
                    </div>

                    {/* Tabbed Content */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                        <TabsList className="w-full">
                            <TabsTrigger value="content" className="flex-1">
                                <FileText className="w-4 h-4 mr-1" />
                                Content
                            </TabsTrigger>
                            <TabsTrigger value="media" className="flex-1">
                                <Image className="w-4 h-4 mr-1" />
                                Media
                            </TabsTrigger>
                            <TabsTrigger value="video" className="flex-1">
                                <Video className="w-4 h-4 mr-1" />
                                Video
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="content" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Post Content</Label>
                                <Textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="Full post caption/content..."
                                    rows={4}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                    <Hash className="w-4 h-4" />
                                    Hashtags
                                </Label>
                                <Input
                                    value={formData.hashtags}
                                    onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                                    placeholder="fitness, health, workout (comma separated)"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Notes (Internal)</Label>
                                <Textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Internal notes for team..."
                                    rows={2}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="media" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Image Generation Prompt</Label>
                                <Textarea
                                    value={formData.image_prompt}
                                    onChange={(e) => setFormData({ ...formData, image_prompt: e.target.value })}
                                    placeholder="Describe the image you want to generate..."
                                    rows={4}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Use the Content Strategist AI to generate images based on this prompt.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="video" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Video Script</Label>
                                <Textarea
                                    value={formData.video_script}
                                    onChange={(e) => setFormData({ ...formData, video_script: e.target.value })}
                                    placeholder="Write your video script here..."
                                    rows={6}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="gap-2">
                        {entry && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span className="ml-2">Delete</span>
                            </Button>
                        )}
                        <div className="flex-1" />
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            <span className="ml-2">{entry ? 'Update' : 'Create'}</span>
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default EntryModal;
