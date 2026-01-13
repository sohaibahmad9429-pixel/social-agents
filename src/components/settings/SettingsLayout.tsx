'use client'

import React, { useState } from 'react'
import { Users, Settings, Activity, ChevronLeft, Zap } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

type Tab = 'members' | 'workspace' | 'activity' | 'accounts'

interface SettingsLayoutProps {
  children: React.ReactNode
  activeTab: Tab
}

const ADMIN_TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  {
    id: 'accounts',
    label: 'Connected Accounts',
    icon: <Zap size={20} />,
  },
  {
    id: 'workspace',
    label: 'Workspace Settings',
    icon: <Settings size={20} />,
  },
]

const COMMON_TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  {
    id: 'members',
    label: 'Members',
    icon: <Users size={20} />,
  },
  {
    id: 'activity',
    label: 'Activity Log',
    icon: <Activity size={20} />,
  },
]

export default function SettingsLayout({ children, activeTab }: SettingsLayoutProps) {
  const { userRole } = useAuth()

  // Show admin tabs only to admins
  const visibleTabs = userRole === 'admin' ? [...ADMIN_TABS, ...COMMON_TABS] : COMMON_TABS

  return (
    <div className="min-h-screen bg-canva-gradient">
      {/* Header - Matching Canva Design */}
      <div className="sticky top-0 z-30 border-b bg-canva-gradient/95 backdrop-blur-sm shadow-sm">
        <div className="relative px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-xl bg-background/50 border border-border text-foreground hover:bg-background/80 transition-all shadow-sm"
              title="Back to Dashboard"
            >
              <ChevronLeft size={20} />
            </Link>

            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Settings className="w-6 h-6 text-primary" />
            </div>

            <div>
              <h1 className="text-lg font-bold text-foreground flex items-center gap-3">
                Workspace Settings
                <span className="bg-primary/10 text-primary border border-primary/20 text-[11px] px-2 py-0.5 h-6 shadow-sm rounded-full inline-flex items-center">
                  <Zap className="w-3 h-3 mr-1" />
                  Admin
                </span>
              </h1>
              <p className="text-muted-foreground text-[13px] mt-0.5">
                Manage your workspace, members, and activity
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl ml-0 pl-2 pr-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-1.5 sticky top-8 max-w-[240px]">
              {visibleTabs.map(tab => (
                <Link
                  key={tab.id}
                  href={`/settings?tab=${tab.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-all ${activeTab === tab.id
                    ? 'bg-primary text-white shadow-md'
                    : 'text-foreground hover:bg-background/50 hover:text-primary'
                    }`}
                >
                  {tab.icon}
                  <span className={activeTab === tab.id ? 'font-semibold' : ''}>{tab.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-background/40 backdrop-blur-md rounded-2xl border border-border/50 p-8 shadow-sm">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
