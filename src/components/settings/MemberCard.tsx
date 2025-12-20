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
        return <Crown size={16} className="text-yellow-600" />
      case 'editor':
        return <Edit size={16} className="text-blue-600" />
      case 'viewer':
        return <Eye size={16} className="text-gray-600" />
      default:
        return <Shield size={16} className="text-gray-600" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'editor':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'viewer':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
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
    <div className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* User Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={member.full_name || member.email}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {(member.full_name || member.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Name & Email */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 truncate">
                {member.full_name || member.email}
              </p>
              {isCurrentUser && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                  You
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 truncate">{member.email}</p>
            {member.created_at && (
              <p className="text-xs text-gray-500 mt-1">
                Joined {formatDate(member.created_at)}
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
              className={`px-3 py-1.5 border rounded-full flex items-center gap-2 text-sm font-medium ${getRoleColor(
                member.role
              )} ${isAdmin && !isCurrentUser
                ? 'cursor-pointer hover:opacity-80'
                : 'cursor-default'
                } disabled:opacity-50`}
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
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => handleRoleChange('admin')}
                    disabled={changingRole}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Crown size={16} className="text-yellow-600" />
                    <span>Admin</span>
                  </button>
                  <button
                    onClick={() => handleRoleChange('editor')}
                    disabled={changingRole}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Edit size={16} className="text-blue-600" />
                    <span>Editor</span>
                  </button>
                  <button
                    onClick={() => handleRoleChange('viewer')}
                    disabled={changingRole}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Eye size={16} className="text-gray-600" />
                    <span>Viewer</span>
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
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
