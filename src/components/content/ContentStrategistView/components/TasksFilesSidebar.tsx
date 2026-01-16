'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle2, Circle, Clock, Folder, File } from 'lucide-react';

interface TodoItem {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
}

interface FileItem {
    path: string;
    content: string;
}

interface TasksFilesSidebarProps {
    todos?: TodoItem[];
    files?: Record<string, string>;
    onFileClick?: (path: string) => void;
    isCollapsed?: boolean;
}

/**
 * TasksFilesSidebar - Right sidebar showing tasks and files
 * Reference: https://github.com/langchain-ai/deep-agents-ui
 */
export const TasksFilesSidebar: React.FC<TasksFilesSidebarProps> = ({
    todos = [],
    files = {},
    onFileClick,
    isCollapsed = false,
}) => {
    const [tasksExpanded, setTasksExpanded] = useState(true);
    const [filesExpanded, setFilesExpanded] = useState(true);

    const fileList = Object.entries(files);

    const getStatusIcon = (status: TodoItem['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 size={14} className="text-green-500" />;
            case 'in_progress':
                return <Clock size={14} className="text-blue-500" />;
            case 'pending':
            default:
                return <Circle size={14} className="text-muted-foreground" />;
        }
    };

    const getStatusBadge = (status: TodoItem['status']) => {
        const labels = {
            pending: 'Pending',
            in_progress: 'In Progress',
            completed: 'Completed',
        };
        const colors = {
            pending: 'bg-muted text-muted-foreground',
            in_progress: 'bg-blue-500/20 text-blue-600',
            completed: 'bg-green-500/20 text-green-600',
        };
        return (
            <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status]}`}>
                {labels[status]}
            </span>
        );
    };

    if (isCollapsed) {
        return (
            <div className="w-12 border-l border-border bg-muted/30 flex flex-col items-center py-4 gap-4">
                <button className="p-2 hover:bg-muted rounded" title="Tasks">
                    <CheckCircle2 size={18} className="text-muted-foreground" />
                </button>
                <button className="p-2 hover:bg-muted rounded" title="Files">
                    <Folder size={18} className="text-muted-foreground" />
                </button>
            </div>
        );
    }

    return (
        <div className="w-72 border-l border-border bg-muted/30 flex flex-col overflow-hidden">
            {/* Tasks Section */}
            <div className="border-b border-border">
                <button
                    onClick={() => setTasksExpanded(!tasksExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-muted-foreground" />
                        <span className="font-medium text-sm">Tasks</span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {todos.length}
                        </span>
                    </div>
                    {tasksExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {tasksExpanded && (
                    <div className="px-2 pb-2 max-h-60 overflow-y-auto">
                        {todos.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                                No tasks yet
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {todos.map((todo) => (
                                    <div
                                        key={todo.id}
                                        className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
                                    >
                                        {getStatusIcon(todo.status)}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-foreground truncate">
                                                {todo.content}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Files Section */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <button
                    onClick={() => setFilesExpanded(!filesExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Folder size={16} className="text-muted-foreground" />
                        <span className="font-medium text-sm">Files</span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {fileList.length}
                        </span>
                    </div>
                    {filesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {filesExpanded && (
                    <div className="flex-1 overflow-y-auto px-2 pb-2">
                        {fileList.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                                No files generated yet
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {fileList.map(([path, content]) => (
                                    <button
                                        key={path}
                                        onClick={() => onFileClick?.(path)}
                                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors text-left"
                                    >
                                        <File size={14} className="text-muted-foreground shrink-0" />
                                        <span className="text-xs text-foreground truncate">
                                            {path.split('/').pop()}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

TasksFilesSidebar.displayName = 'TasksFilesSidebar';

export default TasksFilesSidebar;
