'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

// Types
type VideoProvider = 'sora' | 'veo';

interface VideoJob {
    id: string;
    prompt: string;
    model: string;
    provider: VideoProvider;
    status: 'queued' | 'in_progress' | 'processing' | 'pending' | 'completed' | 'failed';
    progress: number;
    url?: string;
    createdAt: number;
    error?: string;
    // Veo-specific
    operationName?: string;
    veoVideoId?: string;
}

interface VideoGenerationContextType {
    activeJobs: VideoJob[];
    completedJobs: VideoJob[];
    startSoraPolling: (videoId: string, prompt: string, model: string) => void;
    startVeoPolling: (operationId: string, operationName: string, prompt: string, model: string) => void;
    getJobStatus: (jobId: string) => VideoJob | undefined;
    clearCompletedJob: (jobId: string) => void;
    isAnyJobProcessing: boolean;
}

const VideoGenerationContext = createContext<VideoGenerationContextType | undefined>(undefined);

// Hook to use the context
export function useVideoGeneration() {
    const context = useContext(VideoGenerationContext);
    if (!context) {
        throw new Error('useVideoGeneration must be used within VideoGenerationProvider');
    }
    return context;
}

// Provider component
interface VideoGenerationProviderProps {
    children: ReactNode;
}

export function VideoGenerationProvider({ children }: VideoGenerationProviderProps) {
    const [jobs, setJobs] = useState<Map<string, VideoJob>>(new Map());
    const pollIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const pollCountsRef = useRef<Map<string, number>>(new Map());

    const MAX_POLLS_SORA = 96; // 8 minutes at 5s intervals
    const MAX_POLLS_VEO = 48;  // 8 minutes at 10s intervals  
    const SORA_POLL_INTERVAL = 5000;
    const VEO_POLL_INTERVAL = 10000;

    // Poll a Sora video job
    const pollSoraJob = useCallback(async (videoId: string) => {
        const currentCount = pollCountsRef.current.get(videoId) || 0;
        pollCountsRef.current.set(videoId, currentCount + 1);

        if (currentCount >= MAX_POLLS_SORA) {
            setJobs(prev => {
                const newMap = new Map(prev);
                const job = newMap.get(videoId);
                if (job) {
                    newMap.set(videoId, { ...job, status: 'failed', error: 'Generation timed out' });
                }
                return newMap;
            });
            const interval = pollIntervalsRef.current.get(videoId);
            if (interval) { clearInterval(interval); pollIntervalsRef.current.delete(videoId); }
            return;
        }

        try {
            const response = await fetch('/api/ai/media/sora/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId }),
            });

            if (!response.ok) return;
            const data = await response.json();

            if (data.success && data.data?.video) {
                const video = data.data.video;

                if (video.status === 'completed') {
                    const fetchResponse = await fetch('/api/ai/media/sora/fetch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ videoId }),
                    });

                    if (fetchResponse.ok) {
                        const fetchData = await fetchResponse.json();
                        if (fetchData.success) {
                            setJobs(prev => {
                                const newMap = new Map(prev);
                                const job = newMap.get(videoId);
                                if (job) {
                                    newMap.set(videoId, { ...job, status: 'completed', progress: 100, url: fetchData.data?.videoData });
                                }
                                return newMap;
                            });
                        }
                    }
                    const interval = pollIntervalsRef.current.get(videoId);
                    if (interval) { clearInterval(interval); pollIntervalsRef.current.delete(videoId); }
                    pollCountsRef.current.delete(videoId);
                } else if (video.status === 'failed') {
                    setJobs(prev => {
                        const newMap = new Map(prev);
                        const job = newMap.get(videoId);
                        if (job) { newMap.set(videoId, { ...job, status: 'failed', progress: 0, error: video.error || 'Generation failed' }); }
                        return newMap;
                    });
                    const interval = pollIntervalsRef.current.get(videoId);
                    if (interval) { clearInterval(interval); pollIntervalsRef.current.delete(videoId); }
                    pollCountsRef.current.delete(videoId);
                } else {
                    setJobs(prev => {
                        const newMap = new Map(prev);
                        const job = newMap.get(videoId);
                        if (job) { newMap.set(videoId, { ...job, status: video.status, progress: video.progress || 0 }); }
                        return newMap;
                    });
                }
            }
        } catch (err) {
            console.error('Sora poll error:', err);
        }
    }, []);

    // Poll a Veo video job
    const pollVeoJob = useCallback(async (operationId: string, operationName: string) => {
        const currentCount = pollCountsRef.current.get(operationId) || 0;
        pollCountsRef.current.set(operationId, currentCount + 1);

        if (currentCount >= MAX_POLLS_VEO) {
            setJobs(prev => {
                const newMap = new Map(prev);
                const job = newMap.get(operationId);
                if (job) { newMap.set(operationId, { ...job, status: 'failed', error: 'Generation timed out' }); }
                return newMap;
            });
            const interval = pollIntervalsRef.current.get(operationId);
            if (interval) { clearInterval(interval); pollIntervalsRef.current.delete(operationId); }
            return;
        }

        try {
            const response = await fetch('/api/ai/media/veo/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operationId, operationName }),
            });

            if (!response.ok) return;
            const data = await response.json();

            if (data.success) {
                if (data.done) {
                    if (data.status === 'completed' && data.video) {
                        // Download video
                        const downloadResponse = await fetch('/api/ai/media/veo/download', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ veoVideoId: data.video.veoVideoId, operationId, uploadToSupabase: true }),
                        });
                        const downloadData = await downloadResponse.json();
                        const videoUrl = downloadData.url || data.video.url;

                        setJobs(prev => {
                            const newMap = new Map(prev);
                            const job = newMap.get(operationId);
                            if (job) {
                                newMap.set(operationId, { ...job, status: 'completed', progress: 100, url: videoUrl, veoVideoId: data.video.veoVideoId });
                            }
                            return newMap;
                        });
                    } else if (data.status === 'failed') {
                        setJobs(prev => {
                            const newMap = new Map(prev);
                            const job = newMap.get(operationId);
                            if (job) { newMap.set(operationId, { ...job, status: 'failed', progress: 0, error: data.error || 'Generation failed' }); }
                            return newMap;
                        });
                    }
                    const interval = pollIntervalsRef.current.get(operationId);
                    if (interval) { clearInterval(interval); pollIntervalsRef.current.delete(operationId); }
                    pollCountsRef.current.delete(operationId);
                } else {
                    // Still processing
                    setJobs(prev => {
                        const newMap = new Map(prev);
                        const job = newMap.get(operationId);
                        if (job) { newMap.set(operationId, { ...job, status: 'processing', progress: data.progress || 0 }); }
                        return newMap;
                    });
                }
            }
        } catch (err) {
            console.error('Veo poll error:', err);
        }
    }, []);

    // Start Sora polling
    const startSoraPolling = useCallback((videoId: string, prompt: string, model: string) => {
        const job: VideoJob = {
            id: videoId,
            prompt,
            model,
            provider: 'sora',
            status: 'queued',
            progress: 0,
            createdAt: Date.now(),
        };

        setJobs(prev => new Map(prev).set(videoId, job));
        pollCountsRef.current.set(videoId, 0);

        const interval = setInterval(() => pollSoraJob(videoId), SORA_POLL_INTERVAL);
        pollIntervalsRef.current.set(videoId, interval);
        pollSoraJob(videoId);
    }, [pollSoraJob]);

    // Start Veo polling
    const startVeoPolling = useCallback((operationId: string, operationName: string, prompt: string, model: string) => {
        const job: VideoJob = {
            id: operationId,
            prompt,
            model,
            provider: 'veo',
            status: 'pending',
            progress: 0,
            createdAt: Date.now(),
            operationName,
        };

        setJobs(prev => new Map(prev).set(operationId, job));
        pollCountsRef.current.set(operationId, 0);

        const interval = setInterval(() => pollVeoJob(operationId, operationName), VEO_POLL_INTERVAL);
        pollIntervalsRef.current.set(operationId, interval);
        pollVeoJob(operationId, operationName);
    }, [pollVeoJob]);

    const getJobStatus = useCallback((jobId: string) => jobs.get(jobId), [jobs]);

    const clearCompletedJob = useCallback((jobId: string) => {
        setJobs(prev => { const newMap = new Map(prev); newMap.delete(jobId); return newMap; });
    }, []);

    useEffect(() => {
        return () => {
            pollIntervalsRef.current.forEach(interval => clearInterval(interval));
            pollIntervalsRef.current.clear();
        };
    }, []);

    const activeJobs = Array.from(jobs.values()).filter(j =>
        j.status === 'queued' || j.status === 'in_progress' || j.status === 'processing' || j.status === 'pending'
    );
    const completedJobs = Array.from(jobs.values()).filter(j => j.status === 'completed' || j.status === 'failed');
    const isAnyJobProcessing = activeJobs.length > 0;

    return (
        <VideoGenerationContext.Provider value={{
            activeJobs,
            completedJobs,
            startSoraPolling,
            startVeoPolling,
            getJobStatus,
            clearCompletedJob,
            isAnyJobProcessing,
        }}>
            {children}
        </VideoGenerationContext.Provider>
    );
}
