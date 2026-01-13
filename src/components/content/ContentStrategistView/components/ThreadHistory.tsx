/**
 * ThreadHistory Component
 * 
 * Displays chat thread history with search, grouping, and management.
 * Based on langchain-ai/agent-chat-ui patterns.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
    PlusCircle,
    Loader2,
    Trash2,
    Search,
    MessageSquare,
    Calendar,
    Pencil,
    Check,
    X
} from 'lucide-react';
import { ContentThread, ThreadService } from '@/services/database/threadService.client';

interface ThreadHistoryProps {
    threads: ContentThread[];
    activeThreadId: string | 'new';
    isCreatingNewChat: boolean;
    isLoading?: boolean;
    workspaceId: string | null;
    onNewChat: () => void;
    onSelectThread: (thread: ContentThread) => void;
    onDeleteThread: (threadId: string) => void;
    onRenameThread?: (threadId: string, newTitle: string) => void;
}

// Group threads by date
function groupThreadsByDate(threads: ContentThread[]): Record<string, ContentThread[]> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const groups: Record<string, ContentThread[]> = {
        'Today': [],
        'Yesterday': [],
        'Last 7 days': [],
        'Last 30 days': [],
        'Older': [],
    };

    threads.forEach(thread => {
        const date = new Date(thread.updated_at || thread.created_at);

        if (date >= today) {
            groups['Today'].push(thread);
        } else if (date >= yesterday) {
            groups['Yesterday'].push(thread);
        } else if (date >= lastWeek) {
            groups['Last 7 days'].push(thread);
        } else if (date >= lastMonth) {
            groups['Last 30 days'].push(thread);
        } else {
            groups['Older'].push(thread);
        }
    });

    // Remove empty groups
    return Object.fromEntries(
        Object.entries(groups).filter(([_, items]) => items.length > 0)
    );
}

// Single thread item component
const ThreadItem: React.FC<{
    thread: ContentThread;
    isActive: boolean;
    workspaceId: string | null;
    onSelect: () => void;
    onDelete: () => void;
    onRename?: (newTitle: string) => void;
}> = ({ thread, isActive, workspaceId, onSelect, onDelete, onRename }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(thread.title);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleRename = async () => {
        if (editTitle.trim() && editTitle !== thread.title && workspaceId) {
            try {
                await ThreadService.updateThreadTitle(thread.id, workspaceId, editTitle.trim());
                onRename?.(editTitle.trim());
            } catch (e) {
                // Reset on error
                setEditTitle(thread.title);
            }
        }
        setIsEditing(false);
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            onDelete();
        } finally {
            setIsDeleting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRename();
        } else if (e.key === 'Escape') {
            setEditTitle(thread.title);
            setIsEditing(false);
        }
    };

    return (
        <div
            className={`relative group flex items-center gap-2 py-2.5 px-3 rounded-lg transition-all cursor-pointer ${isActive
                ? 'bg-primary/10 border border-primary/20'
                : 'hover:bg-muted/60'
                }`}
            onClick={() => !isEditing && onSelect()}
        >
            <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />

            {isEditing ? (
                <div className="flex-1 flex items-center gap-1">
                    <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleRename}
                        autoFocus
                        className="flex-1 text-sm bg-background border border-border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRename(); }}
                        className="p-1 hover:bg-muted rounded"
                    >
                        <Check className="w-3 h-3 text-green-500" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setEditTitle(thread.title); setIsEditing(false); }}
                        className="p-1 hover:bg-muted rounded"
                    >
                        <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                </div>
            ) : (
                <>
                    <span className={`flex-1 text-sm truncate ${isActive ? 'text-foreground font-medium' : 'text-foreground'}`}>
                        {thread.title}
                    </span>

                    {/* Action buttons - appear on hover */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                            className="p-1.5 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                            title="Rename"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            disabled={isDeleting}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            title="Delete"
                        >
                            {isDeleting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Trash2 className="w-3 h-3" />
                            )}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export const ThreadHistory: React.FC<ThreadHistoryProps> = ({
    threads,
    activeThreadId,
    isCreatingNewChat,
    isLoading = false,
    workspaceId,
    onNewChat,
    onSelectThread,
    onDeleteThread,
    onRenameThread,
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter threads by search query
    const filteredThreads = useMemo(() => {
        if (!searchQuery.trim()) return threads;
        const query = searchQuery.toLowerCase();
        return threads.filter(thread =>
            thread.title.toLowerCase().includes(query)
        );
    }, [threads, searchQuery]);

    // Group filtered threads by date
    const groupedThreads = useMemo(() =>
        groupThreadsByDate(filteredThreads),
        [filteredThreads]
    );

    return (
        <div className="flex flex-col h-full bg-card border-r border-border">
            {/* Header with New Chat button */}
            <div className="p-3 border-b border-border">
                <button
                    onClick={onNewChat}
                    disabled={isCreatingNewChat}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isCreatingNewChat ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <PlusCircle className="w-4 h-4" />
                    )}
                    {isCreatingNewChat ? 'Creating...' : 'New Chat'}
                </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-border">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-muted border-0 rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                ) : Object.keys(groupedThreads).length === 0 ? (
                    <div className="text-center py-8 px-4">
                        <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">
                            {searchQuery ? 'No matching chats' : 'No chat history yet'}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                            {searchQuery ? 'Try a different search' : 'Start a new chat to begin'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(groupedThreads).map(([group, groupThreads]) => (
                            <div key={group}>
                                <div className="flex items-center gap-2 px-3 py-1.5">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {group}
                                    </span>
                                </div>
                                <div className="space-y-0.5">
                                    {groupThreads.map(thread => (
                                        <ThreadItem
                                            key={thread.id}
                                            thread={thread}
                                            isActive={activeThreadId === thread.id}
                                            workspaceId={workspaceId}
                                            onSelect={() => onSelectThread(thread)}
                                            onDelete={() => onDeleteThread(thread.id)}
                                            onRename={(newTitle) => onRenameThread?.(thread.id, newTitle)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Thread count footer */}
            {threads.length > 0 && (
                <div className="p-3 border-t border-border">
                    <p className="text-xs text-center text-muted-foreground">
                        {filteredThreads.length} of {threads.length} chats
                    </p>
                </div>
            )}
        </div>
    );
};
