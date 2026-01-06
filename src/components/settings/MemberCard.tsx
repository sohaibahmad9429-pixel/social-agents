'use client'

import React, { useState } from 'react'
import { User, Shield, Edit, Eye, Trash2, Crown, Loader2 } from 'lucide-react'
import type { WorkspaceMember } from '@/types/workspace'

interface MemberCardProps {
  member: WorkspaceMember
  currentUserId: string
  isAdmin: boolean
  canRemove: boolean
  isRemoving: boolean
  onRemove: () => void
  onRoleChange: (newRole: 'admin' | 'editor' | 'viewer') => void
}

export default function MemberCard({
  member,
  currentUserId,
  isAdmin,
  canRemove,
  isRemoving,
  onRemove,
  onRoleChange
}: MemberCardProps) {
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const [changingRole, setChangingRole] = useState(false)

  const isCurrentUser = member.id === currentUserId

  const handleRoleChange = async (newRole: 'admin' | 'editor' | 'viewer') => {
    if (newRole === member.role) {
      setShowRoleMenu(false)
      return
    }

    setChangingRole(true)
    try {
      await onRoleChange(newRole)
      setShowRoleMenu(false)
    } finally {
      setChangingRole(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown size={16} className="text-amber-600" />
      case 'editor':
        return <Edit size={16} className="text-teal-600" />
      case 'viewer':
        return <Eye size={16} className="text-slate-600" />
      default:
        return <Shield size={16} className="text-slate-600" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border-amber-200'
      case 'editor':
        return 'bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-800 border-teal-200'
      case 'viewer':
        return 'bg-gradient-to-r from-slate-50 to-gray-50 text-slate-700 border-slate-200'
      default:
        return 'bg-gradient-to-r from-slate-50 to-gray-50 text-slate-700 border-slate-200'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="p-5 bg-card border border-border rounded-xl hover:border-teal-300 hover:shadow-md transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* User Info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={member.full_name || member.email}
                className="w-12 h-12 rounded-full object-cover border-2 border-teal-100"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 flex items-center justify-center shadow-md">
                <span className="text-white font-semibold text-base">
                  {(member.full_name || member.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Name & Email */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground truncate">
                {member.full_name || member.email}
              </p>
              {isCurrentUser && (
                <span className="px-2.5 py-0.5 bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-700 text-xs font-medium rounded-full">
                  You
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{member.email}</p>
            {member.created_at && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <span className="text-teal-500">•</span> Joined {formatDate(member.created_at)}
              </p>
            )}
          </div>
        </div>

        {/* Role & Actions */}
        <div className="flex items-center gap-3">
          {/* Role Badge */}
          <div className="relative">
            <button
              onClick={() => isAdmin && !isCurrentUser && setShowRoleMenu(!showRoleMenu)}
              disabled={!isAdmin || isCurrentUser || changingRole}
              className={`px-3.5 py-2 border rounded-xl flex items-center gap-2 text-sm font-semibold shadow-sm ${getRoleColor(
                member.role
              )} ${isAdmin && !isCurrentUser
                ? 'cursor-pointer hover:scale-105 hover:shadow-md'
                : 'cursor-default'
                } disabled:opacity-50 transition-all`}
            >
              {changingRole ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                getRoleIcon(member.role)
              )}
              <span className="capitalize">{member.role}</span>
            </button>

            {/* Role Menu */}
            {showRoleMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowRoleMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-20 py-2 overflow-hidden">
                  <button
                    onClick={() => handleRoleChange('admin')}
                    disabled={changingRole}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50 hover:text-amber-900 flex items-center gap-2.5 disabled:opacity-50 transition-colors"
                  >
                    <Crown size={16} className="text-amber-600" />
                    <span className="font-medium">Admin</span>
                  </button>
                  <button
                    onClick={() => handleRoleChange('editor')}
                    disabled={changingRole}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-teal-50 hover:text-teal-900 flex items-center gap-2.5 disabled:opacity-50 transition-colors"
                  >
                    <Edit size={16} className="text-teal-600" />
                    <span className="font-medium">Editor</span>
                  </button>
                  <button
                    onClick={() => handleRoleChange('viewer')}
                    disabled={changingRole}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 disabled:opacity-50 transition-colors"
                  >
                    <Eye size={16} className="text-slate-600" />
                    <span className="font-medium">Viewer</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Remove Button */}
          {canRemove && (
            <button
              onClick={onRemove}
              disabled={isRemoving}
              className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all hover:scale-110 disabled:opacity-50"
              title="Remove member"
            >
              {isRemoving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
