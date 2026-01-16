/**
 * SubAgentIndicator - Shows sub-agent activity
 * Reference: https://github.com/langchain-ai/deep-agents-ui
 */
'use client';

import React from 'react';
import { Bot, Loader2, Check, AlertCircle } from 'lucide-react';
import { SubAgent } from '../types';

interface SubAgentIndicatorProps {
    subAgent: SubAgent;
}

export function SubAgentIndicator({ subAgent }: SubAgentIndicatorProps) {
    const getStatusIcon = () => {
        switch (subAgent.status) {
            case 'completed':
                return <Check className="w-4 h-4 text-green-500" />;
            case 'active':
            case 'pending':
                return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Bot className="w-4 h-4 text-gray-500" />;
        }
    };

    const getStatusText = () => {
        switch (subAgent.status) {
            case 'completed':
                return 'Completed';
            case 'active':
                return 'Working...';
            case 'pending':
                return 'Starting...';
            case 'error':
                return 'Failed';
            default:
                return 'Unknown';
        }
    };

    const getStatusColor = () => {
        switch (subAgent.status) {
            case 'completed':
                return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
            case 'active':
            case 'pending':
                return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
            case 'error':
                return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
            default:
                return 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700';
        }
    };

    return (
        <div className={`flex items-center gap-2 p-3 rounded-lg border my-2 ${getStatusColor()}`}>
            <Bot className="w-5 h-5 text-purple-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="font-medium text-sm capitalize">
                    {subAgent.subAgentName || subAgent.name}
                </div>
                {typeof subAgent.input?.description === 'string' ? (
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {subAgent.input.description}
                    </div>
                ) : null}
            </div>
            <div className="flex items-center gap-1.5 text-xs">
                {getStatusIcon()}
                <span className="text-gray-600 dark:text-gray-400">
                    {getStatusText()}
                </span>
            </div>
        </div>
    );
}

export default SubAgentIndicator;
