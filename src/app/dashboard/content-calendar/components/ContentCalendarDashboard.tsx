'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Plus,
    Filter,
    Loader2,
    CalendarDays,
    Grid3X3,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarMonthView } from './CalendarMonthView';
import { EntryModal } from './EntryModal';
import { CalendarFilters } from './CalendarFilters';
import type { CalendarEntry, CalendarFilters as FilterType, Platform } from '../types';


export function ContentCalendarDashboard() {
    const { session } = useAuth();
    const [view, setView] = useState<'week' | 'month'>('week');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [entries, setEntries] = useState<CalendarEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filters, setFilters] = useState<FilterType>({});
    const [showFilters, setShowFilters] = useState(false);
    const [platformFilter, setPlatformFilter] = useState<Platform | undefined>(undefined);

    const fetchEntries = useCallback(async () => {
        if (!session?.access_token) return;

        setLoading(true);
        try {
            const params = new URLSearchParams();

            // Calculate date range based on view
            const start = new Date(currentDate);
            const end = new Date(currentDate);

            if (view === 'week') {
                start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
                end.setDate(start.getDate() + 6); // End of week
            } else {
                start.setDate(1); // Start of month
                end.setMonth(end.getMonth() + 1, 0); // End of month
            }

            params.append('start_date', start.toISOString().split('T')[0]);
            params.append('end_date', end.toISOString().split('T')[0]);

            if (filters.platform) params.append('platform', filters.platform);
            if (filters.content_type) params.append('content_type', filters.content_type);
            if (filters.status) params.append('status', filters.status);

            const response = await fetch(
                `/api/calendar?${params.toString()}`,
                {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                setEntries(data);
            }
        } catch (error) {
            console.error('Error fetching calendar entries:', error);
        } finally {
            setLoading(false);
        }
    }, [session?.access_token, currentDate, view, filters]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);



    const navigateDate = (direction: 'prev' | 'next') => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (view === 'week') {
                newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
            } else {
                newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
            }
            return newDate;
        });
    };

    const handleEntryClick = (entry: CalendarEntry) => {
        setSelectedEntry(entry);
        setIsModalOpen(true);
    };

    const handleNewEntry = () => {
        setSelectedEntry(null);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedEntry(null);
    };

    const handleEntrySaved = () => {
        handleModalClose();
        fetchEntries();
    };

    const formatDateRange = () => {
        if (view === 'week') {
            const start = new Date(currentDate);
            start.setDate(start.getDate() - start.getDay());
            const end = new Date(start);
            end.setDate(end.getDate() + 6);

            const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return `${startStr} - ${endStr}`;
        } else {
            return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
    };

    const hasActiveFilters = filters.platform || filters.content_type || filters.status;

    return (
        <div className="flex flex-col h-full gap-4 p-3">
            {/* Header Section */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 shadow-lg shadow-purple-500/25">
                        <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-foreground">
                            Content Calendar
                        </h1>
                        <p className="text-muted-foreground text-[11px]">
                            Plan, schedule, and manage your social media content
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                        variant={hasActiveFilters ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="gap-1.5 h-7 px-2.5 text-[11px]"
                    >
                        <Filter className="w-3 h-3" />
                        Filters
                        {hasActiveFilters && (
                            <Badge variant="secondary" className="ml-1 bg-white/20 h-4 px-1.5 text-[9px]">
                                Active
                            </Badge>
                        )}
                    </Button>
                    <Button
                        onClick={handleNewEntry}
                        className="gap-1.5 h-7 px-2.5 text-[11px] bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/25"
                    >
                        <Plus className="w-3 h-3" />
                        New Entry
                    </Button>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <CalendarFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    onClose={() => setShowFilters(false)}
                />
            )}

            {/* Calendar Card */}
            <Card className="flex-1 shadow-sm">
                <CardHeader className="pb-3 border-b">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Date Navigation */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => navigateDate('prev')}
                                className="rounded-full h-7 w-7"
                            >
                                <ChevronLeft className="w-3 h-3" />
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setCurrentDate(new Date())}
                                className="h-7 px-2.5 text-[11px] font-medium"
                            >
                                Today
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => navigateDate('next')}
                                className="rounded-full h-7 w-7"
                            >
                                <ChevronRight className="w-3 h-3" />
                            </Button>
                            <div className="ml-2 px-2.5 py-0.5 bg-muted/50 rounded-full">
                                <span className="font-semibold text-[12px]">{formatDateRange()}</span>
                            </div>
                        </div>

                        {/* View Toggle & Refresh */}
                        <div className="flex items-center gap-2">
                            <Tabs value={view} onValueChange={(v) => setView(v as 'week' | 'month')}>
                                <TabsList className="h-7">
                                    <TabsTrigger value="week" className="flex items-center gap-1.5 px-2.5 text-[11px]">
                                        <CalendarDays className="w-3 h-3" />
                                        Week
                                    </TabsTrigger>
                                    <TabsTrigger value="month" className="flex items-center gap-1.5 px-2.5 text-[11px]">
                                        <Grid3X3 className="w-3 h-3" />
                                        Month
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={fetchEntries}
                                disabled={loading}
                                className="rounded-full h-7 w-7"
                            >
                                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[450px] gap-3">
                            <div className="relative">
                                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
                            </div>
                            <p className="text-muted-foreground">Loading your content...</p>
                        </div>
                    ) : view === 'week' ? (
                        <CalendarWeekView
                            entries={platformFilter ? entries.filter(e => e.platform === platformFilter) : entries}
                            allEntries={entries}
                            currentDate={currentDate}
                            onEntryClick={handleEntryClick}
                            activeFilter={platformFilter}
                            onFilterChange={setPlatformFilter}
                        />
                    ) : (
                        <CalendarMonthView
                            entries={platformFilter ? entries.filter(e => e.platform === platformFilter) : entries}
                            allEntries={entries}
                            currentDate={currentDate}
                            onEntryClick={handleEntryClick}
                            activeFilter={platformFilter}
                            onFilterChange={setPlatformFilter}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Entry Modal */}
            <EntryModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                entry={selectedEntry}
                onSave={handleEntrySaved}
            />
        </div>
    );
}

export default ContentCalendarDashboard;
