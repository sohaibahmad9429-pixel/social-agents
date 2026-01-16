/**
 * Content Strategist Global Store
 * 
 * Persists chat state across page navigation using Zustand.
 */

import { create } from 'zustand';

interface AttachedFile {
    type: 'image' | 'file';
    name: string;
    url: string;
    size?: number;
}

interface ToolCall {
    id: string;
    name: string;
    args: Record<string, unknown>;
    status?: 'pending' | 'completed' | 'error' | 'interrupted';
    result?: string;
}

interface SubAgent {
    id: string;
    name: string;
    subAgentName: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    status: 'pending' | 'active' | 'completed' | 'error';
}

interface Message {
    role: 'user' | 'model' | 'system';
    content: string;
    attachments?: AttachedFile[];
    isStreaming?: boolean;
    suggestions?: string[];
    thinking?: string;
    isThinking?: boolean;
    tool_calls?: ToolCall[];
    sub_agents?: SubAgent[];
    files?: Array<{ path: string; name: string; type: string }>;
    generatedImage?: string;
    generatedVideo?: string;
    isGeneratingMedia?: boolean;
    postData?: unknown;
    parameters?: unknown;
    isVoiceGenerated?: boolean;
}

interface ContentStrategistState {
    messages: Message[];
    hasUserSentMessage: boolean;
    error: string | null;
    activeThreadId: string | null;
    langThreadId: string | null;
    isVoiceActive: boolean;

    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
    addMessage: (message: Message) => void;
    setHasUserSentMessage: (value: boolean) => void;
    setError: (error: string | null) => void;
    setActiveThreadId: (id: string | null) => void;
    setLangThreadId: (id: string | null) => void;
    setIsVoiceActive: (active: boolean) => void;
    clearChat: () => void;
}

export const useContentStrategistStore = create<ContentStrategistState>((set) => ({
    messages: [],
    hasUserSentMessage: false,
    error: null,
    activeThreadId: null,
    langThreadId: null,
    isVoiceActive: false,

    setMessages: (messages) =>
        set((state) => ({
            messages: typeof messages === 'function' ? messages(state.messages) : messages,
        })),

    addMessage: (message) =>
        set((state) => ({
            messages: [...state.messages, message],
            hasUserSentMessage: message.role === 'user' ? true : state.hasUserSentMessage,
        })),

    setHasUserSentMessage: (value) => set({ hasUserSentMessage: value }),
    setError: (error) => set({ error }),
    setActiveThreadId: (id) => set({ activeThreadId: id }),
    setLangThreadId: (id) => set({ langThreadId: id }),
    setIsVoiceActive: (active) => set({ isVoiceActive: active }),
    clearChat: () => set({ messages: [], hasUserSentMessage: false, error: null }),
}));
