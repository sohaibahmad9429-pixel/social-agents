'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import type { CalendarEntry, CalendarFilters as FilterType } from '../types';

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

    return (
        <div className="flex flex-col h-full gap-4 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                        <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Content Calendar</h1>
                        <p className="text-sm text-muted-foreground">Plan and schedule your content</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                        <Filter className="w-4 h-4 mr-2" />
                        Filters
                    </Button>
                    <Button onClick={handleNewEntry}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Entry
                    </Button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <CalendarFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    onClose={() => setShowFilters(false)}
                />
            )}

            {/* Calendar Controls */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* Date Navigation */}
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
                                Today
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                            <span className="ml-2 font-semibold text-lg">{formatDateRange()}</span>
                        </div>

                        {/* View Toggle & Refresh */}
                        <div className="flex items-center gap-2">
                            <Tabs value={view} onValueChange={(v) => setView(v as 'week' | 'month')}>
                                <TabsList>
                                    <TabsTrigger value="week" className="flex items-center gap-1">
                                        <CalendarDays className="w-4 h-4" />
                                        Week
                                    </TabsTrigger>
                                    <TabsTrigger value="month" className="flex items-center gap-1">
                                        <Grid3X3 className="w-4 h-4" />
                                        Month
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <Button variant="ghost" size="icon" onClick={fetchEntries} disabled={loading}>
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-[400px]">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : view === 'week' ? (
                        <CalendarWeekView
                            entries={entries}
                            currentDate={currentDate}
                            onEntryClick={handleEntryClick}
                        />
                    ) : (
                        <CalendarMonthView
                            entries={entries}
                            currentDate={currentDate}
                            onEntryClick={handleEntryClick}
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
