/**
 * ChatMessage - Renders individual chat messages with tool calls and sub-agents
 * Reference: https://github.com/langchain-ai/deep-agents-ui
 */
'use client';

import React from 'react';
import { User, Bot, Loader2 } from 'lucide-react';
import { Message } from '../types';
import { ToolCallBox } from './ToolCallBox';
import { SubAgentIndicator } from './SubAgentIndicator';
import { ThinkingDisplay } from './ThinkingDisplay';
import { MarkdownContent } from './MarkdownContent';

interface ChatMessageProps {
    message: Message;
    isLast?: boolean;
}

export function ChatMessage({ message, isLast = false }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const isStreaming = message.isStreaming;
    const isThinking = message.isThinking;

    return (
        <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser
                    ? 'bg-blue-500 text-white'
                    : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                }`}>
                {isUser ? (
                    <User className="w-4 h-4" />
                ) : (
                    <Bot className="w-4 h-4" />
                )}
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}>
                {/* User message bubble */}
                {isUser ? (
                    <div className="inline-block bg-blue-500 text-white px-4 py-2 rounded-2xl rounded-tr-sm">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2 justify-end">
                                {message.attachments.map((file, idx) => (
                                    <div key={idx} className="text-xs bg-blue-400/50 px-2 py-1 rounded">
                                        {file.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* AI message */
                    <div className="space-y-2">
                        {/* Thinking indicator */}
                        {isThinking && message.thinking && (
                            <ThinkingDisplay
                                thinking={message.thinking}
                                isThinking={isThinking}
                            />
                        )}

                        {/* Sub-agents */}
                        {message.sub_agents && message.sub_agents.length > 0 && (
                            <div className="space-y-1">
                                {message.sub_agents.map((sa, idx) => (
                                    <SubAgentIndicator key={sa.id || idx} subAgent={sa} />
                                ))}
                            </div>
                        )}

                        {/* Tool calls */}
                        {message.tool_calls && message.tool_calls.length > 0 && (
                            <div className="space-y-1">
                                {message.tool_calls.map((tc, idx) => (
                                    <ToolCallBox key={tc.id || idx} toolCall={tc} />
                                ))}
                            </div>
                        )}

                        {/* Main content */}
                        {message.content && (
                            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm">
                                <MarkdownContent content={message.content} />
                            </div>
                        )}

                        {/* Streaming indicator */}
                        {isStreaming && !message.content && !isThinking && (
                            <div className="flex items-center gap-2 text-gray-500 px-4 py-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">Thinking...</span>
                            </div>
                        )}

                        {/* Generated files */}
                        {message.files && message.files.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {message.files.map((file, idx) => (
                                    <div key={idx} className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded flex items-center gap-1">
                                        <span>{file.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Suggestions */}
                        {message.suggestions && message.suggestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {message.suggestions.map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChatMessage;
