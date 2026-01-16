'use client';

import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
    content: string;
    className?: string;
}

/**
 * MarkdownContent - Renders markdown with syntax highlighting
 * Reference: https://github.com/langchain-ai/deep-agents-ui
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = memo(({
    content,
    className = '',
}) => {
    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Code blocks
                    code: ({ className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;

                        if (isInline) {
                            return (
                                <code
                                    className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        }

                        return (
                            <div className="relative group">
                                <div className="absolute top-2 right-2 text-xs text-muted-foreground opacity-70">
                                    {match[1]}
                                </div>
                                <pre className="bg-muted/50 rounded-lg p-4 overflow-x-auto">
                                    <code className={`text-sm font-mono ${className}`} {...props}>
                                        {children}
                                    </code>
                                </pre>
                            </div>
                        );
                    },
                    // Links
                    a: ({ href, children, ...props }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            {...props}
                        >
                            {children}
                        </a>
                    ),
                    // Tables
                    table: ({ children, ...props }) => (
                        <div className="overflow-x-auto my-4">
                            <table className="min-w-full border-collapse border border-border" {...props}>
                                {children}
                            </table>
                        </div>
                    ),
                    th: ({ children, ...props }) => (
                        <th className="border border-border px-3 py-2 bg-muted text-left font-semibold" {...props}>
                            {children}
                        </th>
                    ),
                    td: ({ children, ...props }) => (
                        <td className="border border-border px-3 py-2" {...props}>
                            {children}
                        </td>
                    ),
                    // Lists
                    ul: ({ children, ...props }) => (
                        <ul className="list-disc list-inside space-y-1 my-2" {...props}>
                            {children}
                        </ul>
                    ),
                    ol: ({ children, ...props }) => (
                        <ol className="list-decimal list-inside space-y-1 my-2" {...props}>
                            {children}
                        </ol>
                    ),
                    // Blockquotes
                    blockquote: ({ children, ...props }) => (
                        <blockquote
                            className="border-l-4 border-primary/50 pl-4 italic my-4 text-muted-foreground"
                            {...props}
                        >
                            {children}
                        </blockquote>
                    ),
                    // Headings
                    h1: ({ children, ...props }) => (
                        <h1 className="text-2xl font-bold mt-6 mb-3" {...props}>{children}</h1>
                    ),
                    h2: ({ children, ...props }) => (
                        <h2 className="text-xl font-bold mt-5 mb-2" {...props}>{children}</h2>
                    ),
                    h3: ({ children, ...props }) => (
                        <h3 className="text-lg font-semibold mt-4 mb-2" {...props}>{children}</h3>
                    ),
                    // Paragraphs
                    p: ({ children, ...props }) => (
                        <p className="my-2 leading-relaxed" {...props}>{children}</p>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
});

MarkdownContent.displayName = 'MarkdownContent';

export default MarkdownContent;
