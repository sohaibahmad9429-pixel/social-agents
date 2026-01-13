'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Edit3,
    History,
    BarChart3,
    Settings,
    User,
    Sparkles,
    FolderOpen,
    Megaphone,
    MessageSquare,
    Video,
    Palette,
    Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ModeToggle } from '@/components/ui/mode-toggle';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import NotificationBell from '@/components/ui/NotificationBell';

const sidebarItems = [
    { icon: Edit3, label: 'Create Content', href: '/dashboard/create' },
    { icon: Video, label: 'Media Studio', href: '/dashboard/media-studio' },
    { icon: Palette, label: 'Canva Editor', href: '/dashboard/canva-editor' },
    { icon: FolderOpen, label: 'Library', href: '/dashboard/library' },
    { icon: Send, label: 'Publish', href: '/dashboard/history' },
    { icon: BarChart3, label: 'Analytics', href: '/dashboard/analytics' },
    { icon: MessageSquare, label: 'Inbox', href: '/dashboard/comments' },
    { icon: Megaphone, label: 'Meta Ads', href: '/dashboard/meta-ads' },
];



export function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();

    return (
        <TooltipProvider delayDuration={0}>
            <div className="flex h-full w-[72px] flex-col items-center bg-white/10 backdrop-blur-xl border-r border-white/20 pt-1 pb-2 shadow-sm z-40">
                {/* Logo - Enterprise Style */}
                <div className="mb-0">
                    <Link href="/dashboard" className="group">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl overflow-hidden bg-white/20 border border-white/30 shadow-md transition-all duration-300 group-hover:shadow-lg group-hover:scale-105">
                            <img
                                src="/frappe-framework-logo.svg"
                                alt="Logo"
                                className="h-11 w-11"
                            />
                        </div>
                    </Link>
                </div>

                {/* Dark/Light Mode Toggle - Below Logo */}
                <div className="mb-0">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 text-foreground/70 hover:text-foreground hover:bg-white/20">
                                <ModeToggle />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8} className="bg-slate-800 border-slate-700 text-white shadow-xl px-3 py-2">
                            <p className="font-medium text-[13px]">Toggle Theme</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                {/* Main Navigation - Enterprise Standard */}
                <nav className="flex flex-1 flex-col items-center gap-1.5">
                    {sidebarItems.map((item, index) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        return (
                            <Tooltip key={index}>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
                                            isActive
                                                ? "bg-white/30 text-primary shadow-sm border border-white/40"
                                                : "text-foreground/60 hover:text-primary hover:bg-white/20"
                                        )}
                                    >
                                        {/* Active indicator bar */}
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                                        )}
                                        <item.icon className="relative h-[22px] w-[22px] transition-all duration-200" />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={8} className="bg-slate-800 border-slate-700 text-white shadow-xl px-3 py-2">
                                    <p className="font-medium text-[13px]">{item.label}</p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </nav>

                {/* Bottom Section - Enterprise Standard */}
                <div className="flex flex-col items-center gap-1.5 pt-4 border-t border-slate-200/80 mt-2">

                    {/* Notifications */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                                <NotificationBell
                                    side="right"
                                    className="p-0 text-inherit hover:text-inherit hover:bg-transparent [&_svg]:h-5 [&_svg]:w-5"
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8} className="bg-slate-800 border-slate-700 text-white shadow-xl px-3 py-2">
                            <p className="font-medium text-[13px]">Notifications</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Settings */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link
                                href="/settings"
                                className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                                    pathname?.startsWith('/settings')
                                        ? "bg-white/30 text-primary border border-white/40"
                                        : "text-foreground/60 hover:text-primary hover:bg-white/20"
                                )}
                            >
                                <Settings className="h-5 w-5" />
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8} className="bg-slate-800 border-slate-700 text-white shadow-xl px-3 py-2">
                            <p className="font-medium text-[13px]">Settings</p>
                        </TooltipContent>
                    </Tooltip>


                    {/* User Avatar - Enterprise Style */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link href="/settings?tab=profile" className="mt-3">
                                <Avatar className="h-10 w-10 ring-2 ring-slate-200 ring-offset-2 ring-offset-white transition-all hover:ring-teal-400/50 hover:scale-105">
                                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                                    <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white text-sm font-semibold">
                                        {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8} className="bg-slate-800 border-slate-700 text-white shadow-xl px-3 py-2">
                            <p className="font-medium text-[13px]">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Profile'}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </TooltipProvider >
    );
}
