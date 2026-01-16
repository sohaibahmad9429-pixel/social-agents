/**
 * ToolCallBox - Collapsible tool call visualization
 * Reference: https://github.com/langchain-ai/deep-agents-ui
 */
'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Check, Loader2, AlertCircle } from 'lucide-react';
import { ToolCall } from '../types';

interface ToolCallBoxProps {
    toolCall: ToolCall;
    isExpanded?: boolean;
}

export function ToolCallBox({ toolCall, isExpanded: initialExpanded = false }: ToolCallBoxProps) {
    const [isExpanded, setIsExpanded] = useState(initialExpanded);

    const getStatusIcon = () => {
        switch (toolCall.status) {
            case 'completed':
                return <Check className="w-4 h-4 text-green-500" />;
            case 'pending':
                return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'error':
            case 'interrupted':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Wrench className="w-4 h-4 text-gray-500" />;
        }
    };

    const formatToolName = (name: string) => {
        return name
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden my-2 bg-gray-50 dark:bg-gray-800/50">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
                {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <Wrench className="w-4 h-4 text-purple-500" />
                <span className="font-medium text-sm flex-1">
                    {formatToolName(toolCall.name)}
                </span>
                {getStatusIcon()}
            </button>

            {isExpanded && (
                <div className="p-3 pt-0 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    {toolCall.args && Object.keys(toolCall.args).length > 0 && (
                        <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Arguments
                            </div>
                            <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                                {JSON.stringify(toolCall.args, null, 2)}
                            </pre>
                        </div>
                    )}

                    {toolCall.result && (
                        <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Result
                            </div>
                            <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
                                {toolCall.result}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ToolCallBox;
