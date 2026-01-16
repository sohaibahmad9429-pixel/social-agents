/**
 * ChatInterface - Main chat interface with message list and input
 * Reference: https://github.com/langchain-ai/deep-agents-ui
 */
'use client';

import React, { useRef, useEffect, useState, FormEvent } from 'react';
import { Message, AttachedFile } from '../types';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useFileUpload } from '../hooks/useFileUpload';

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (message: string, attachedFiles?: AttachedFile[]) => void;
    isLoading?: boolean;
    error?: string | null;
    showInput?: boolean;
    inputPlaceholder?: string;
}

export function ChatInterface({
    messages,
    onSendMessage,
    isLoading = false,
    error: externalError,
    showInput = true,
}: ChatInterfaceProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Local state for input
    const [userInput, setUserInput] = useState('');
    const [selectedModelId, setSelectedModelId] = useState('gemini-2.5-flash');
    const [enableReasoning, setEnableReasoning] = useState(true);

    // File upload handling - use the hook's return values correctly
    const {
        attachedFiles,
        showUploadMenu,
        setShowUploadMenu,
        fileInputRef,
        imageInputRef,
        error: uploadError,
        handleFileUpload,
        removeAttachment,
        clearBlocks,
    } = useFileUpload();

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (userInput.trim() && !isLoading) {
            onSendMessage(userInput.trim(), attachedFiles);
            setUserInput('');
            clearBlocks();
        }
    };

    // Combine errors
    const combinedError = externalError || uploadError;

    return (
        <div className="flex flex-col h-full">
            {/* Messages area */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
            >
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            Content Strategist
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                            I can help you create blog posts, social media content, and more. Just describe what you need!
                        </p>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <ChatMessage
                                key={index}
                                message={message}
                                isLast={index === messages.length - 1}
                            />
                        ))}
                    </>
                )}

                {/* Error display */}
                {combinedError && (
                    <div className="mx-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                        {combinedError}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {showInput && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                    <ChatInput
                        userInput={userInput}
                        setUserInput={setUserInput}
                        handleSubmit={handleSubmit}
                        isLoading={isLoading}
                        isCreatingNewChat={false}
                        error={combinedError}
                        attachedFiles={attachedFiles}
                        removeAttachment={removeAttachment}
                        showUploadMenu={showUploadMenu}
                        setShowUploadMenu={setShowUploadMenu}
                        isRecording={false}
                        toggleVoiceInput={() => { }}
                        imageInputRef={imageInputRef}
                        fileInputRef={fileInputRef}
                        inputRef={inputRef}
                        handleFileUpload={handleFileUpload}
                        selectedModelId={selectedModelId}
                        setSelectedModelId={setSelectedModelId}
                        enableReasoning={enableReasoning}
                        setEnableReasoning={setEnableReasoning}
                    />
                </div>
            )}
        </div>
    );
}

export default ChatInterface;
