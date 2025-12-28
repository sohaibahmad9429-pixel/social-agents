'use client'

import React from 'react';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { MediaProvider } from '@/contexts/MediaContext';
import { VideoGenerationProvider } from '@/contexts/VideoGenerationContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function DashboardClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardProvider>
            <MediaProvider>
                <VideoGenerationProvider>
                    <DashboardLayout>
                        {children}
                    </DashboardLayout>
                </VideoGenerationProvider>
            </MediaProvider>
        </DashboardProvider>
    );
}

