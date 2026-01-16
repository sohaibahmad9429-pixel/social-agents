/**
 * ContentStrategistView - Main view component
 * Reference: https://github.com/langchain-ai/deep-agents-ui
 */
'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useContentStrategistStore } from '@/stores/contentStrategistStore';
import { useChat } from './hooks/useChat';
import { useThreadManagement } from './hooks/useThreadManagement';
import { useChatHistory } from './hooks/useChatHistory';
import { ContentStrategistViewProps, Message } from './types';
import { ContentThread } from '@/services/database/threadService.client';

// Components
import { ChatInterface } from './components/ChatInterface';
import { ThreadHistory } from './components/ThreadHistory';
import { TasksFilesSidebar } from './components/TasksFilesSidebar';

export default function ContentStrategistView({ onPostCreated }: ContentStrategistViewProps) {
    // Store state
    const messages = useContentStrategistStore(state => state.messages);
    const setMessages = useContentStrategistStore(state => state.setMessages);
    const error = useContentStrategistStore(state => state.error);
    const setError = useContentStrategistStore(state => state.setError);
    const clearChat = useContentStrategistStore(state => state.clearChat);

    // Local state
    const [isLoading, setIsLoading] = useState(false);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isHistoryVisible] = useState(true); // History panel is visible by default

    // Get workspace ID and user ID from localStorage
    useEffect(() => {
        const storedWorkspaceId = localStorage.getItem('workspaceId');
        const storedUserId = localStorage.getItem('userId');
        if (storedWorkspaceId) setWorkspaceId(storedWorkspaceId);
        if (storedUserId) setUserId(storedUserId);
    }, []);

    // Thread management
    const {
        activeThreadId,
        langThreadId,
        isCreatingNewChat,
        startNewChat,
        loadThread,
        setActiveThreadId,
        setLangThreadId,
    } = useThreadManagement();

    // Chat history - uses correct signature
    const { chatHistory, isLoadingHistory, deleteThread, renameThread, refreshHistory } = useChatHistory(isHistoryVisible, workspaceId);

    // Chat hook
    const { submit, abort } = useChat({
        threadId: langThreadId,
        workspaceId: workspaceId || undefined,
        enableReasoning: true,
        onThreadCreated: (newThreadId) => {
            setLangThreadId(newThreadId);
        },
    });

    // Handle new chat creation
    const handleNewChat = useCallback(async () => {
        await startNewChat();
        clearChat();
    }, [startNewChat, clearChat]);

    // Handle thread selection
    const handleSelectThread = useCallback(async (thread: ContentThread) => {
        try {
            const loadedMessages = await loadThread(thread);
            setMessages(loadedMessages as Message[]);
        } catch (error) {
            console.error('Failed to load thread:', error);
            setError('Failed to load conversation');
        }
    }, [loadThread, setMessages, setError]);

    // Handle delete thread
    const handleDeleteThread = useCallback(async (threadId: string) => {
        try {
            await deleteThread(threadId);
            // If we deleted the active thread, clear chat
            if (activeThreadId === threadId) {
                clearChat();
            }
        } catch (error) {
            console.error('Failed to delete thread:', error);
            setError('Failed to delete conversation');
        }
    }, [deleteThread, activeThreadId, clearChat, setError]);

    // Handle rename thread
    const handleRenameThread = useCallback((threadId: string, newTitle: string) => {
        renameThread(threadId, newTitle);
    }, [renameThread]);

    // Handle send message
    const handleSendMessage = useCallback(async (
        message: string,
        attachedFiles?: Array<{ type: 'image' | 'file'; name: string; url: string; size?: number }>
    ) => {
        if (!message.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            await submit(message, { attachedFiles });
        } catch (error) {
            console.error('Failed to send message:', error);
            setError(error instanceof Error ? error.message : 'Failed to send message');
        } finally {
            setIsLoading(false);
        }
    }, [submit, isLoading, setError]);

    // Extract files from messages for sidebar - convert to Record format
    const filesRecord = messages.flatMap(m => m.files || []).reduce((acc, file) => {
        acc[file.path] = file.name;
        return acc;
    }, {} as Record<string, string>);

    return (
        <div className="flex h-full bg-white dark:bg-gray-900">
            {/* Left Sidebar - Thread History */}
            <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 hidden md:block">
                <ThreadHistory
                    threads={chatHistory}
                    activeThreadId={activeThreadId}
                    onSelectThread={handleSelectThread}
                    onNewChat={handleNewChat}
                    onDeleteThread={handleDeleteThread}
                    onRenameThread={handleRenameThread}
                    isLoading={isLoadingHistory}
                    isCreatingNewChat={isCreatingNewChat}
                    workspaceId={workspaceId}
                />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading}
                    error={error}
                    showInput={true}
                    inputPlaceholder="What content would you like to create today?"
                />
            </div>

            {/* Right Sidebar - Tasks & Files */}
            <div className="w-72 border-l border-gray-200 dark:border-gray-700 flex-shrink-0 hidden lg:block">
                <TasksFilesSidebar
                    files={filesRecord}
                    onFileClick={(path) => {
                        console.log('File clicked:', path);
                    }}
                />
            </div>
        </div>
    );
}
