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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-card via-card to-muted/20 border-b border-border shadow-sm">
        <div className="max-w-7xl ml-0 pl-2 pr-4 py-4">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/"
              className="p-1.5 -ml-1.5 rounded-xl bg-card border border-border/40 text-teal-600 hover:text-teal-700 hover:border-teal-200 hover:bg-teal-50/50 transition-all shadow-sm"
              title="Back to Dashboard"
            >
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Workspace Settings
            </h1>
          </div>
          <p className="text-muted-foreground text-sm pl-9">Manage your workspace, members, and activity</p>
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
                  className={`flex items-center gap-2 px-2 py-2 rounded-xl font-medium transition-all ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg shadow-teal-500/20'
                    : 'text-foreground hover:bg-muted/80 hover:text-teal-600'
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
            <div className="bg-card rounded-2xl border border-border p-8 shadow-lg shadow-black/5">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
