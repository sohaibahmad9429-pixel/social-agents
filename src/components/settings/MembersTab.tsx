'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { Users, UserX, Trash2, Loader2, AlertCircle } from 'lucide-react'
import {
  getMembers,
  getInvites,
  removeMember,
  updateMemberRole,
  deleteInvite,
} from '@/lib/python-backend/api/workspace'
import type {
  WorkspaceMember,
  WorkspaceInvite,
} from '@/lib/python-backend/types'
import InviteMemberModal from './InviteMemberModal'
import MemberCard from './MemberCard'

export default function MembersTab() {
  const { workspaceId, userRole, user } = useAuth()
  const { addNotification } = useNotifications()
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null)

  const isAdmin = userRole === 'admin'

  // Production guard: User must be authenticated to view members
  if (!user) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-semibold text-red-900">Authentication Required</h3>
          <p className="text-sm text-red-800 mt-1">
            Please sign in to access member management.
          </p>
        </div>
      </div>
    )
  }

  const currentUserId = user.id

  // Load members and invites
  useEffect(() => {
    if (!workspaceId) return
    loadData()
  }, [workspaceId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [membersData, invitesData] = await Promise.all([
        getMembers(),
        isAdmin ? getInvites() : Promise.resolve([] as WorkspaceInvite[])
      ])
      setMembers(membersData)
      setInvites(invitesData)
    } catch (error: any) {
      console.error('Failed to load data:', error)
      addNotification('error', 'Failed to load members', error.message || 'Please try again')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin) return

    // Confirm deletion
    if (!confirm('Are you sure you want to remove this member from the workspace?')) {
      return
    }

    try {
      setRemovingMemberId(memberId)
      await removeMember(memberId)

      // Update local state
      setMembers(prev => prev.filter(m => m.id !== memberId))
      addNotification('post_published', 'Success', 'Member removed successfully')
    } catch (error: any) {
      console.error('Failed to remove member:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to remove member'
      addNotification('error', 'Removal Failed', errorMessage)
    } finally {
      setRemovingMemberId(null)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    if (!isAdmin) return

    try {
      await updateMemberRole(memberId, newRole)

      // Update local state
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, role: newRole } : m
      ))
      addNotification('post_published', 'Success', 'Member role updated successfully')
    } catch (error: any) {
      console.error('Failed to update role:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update role'
      addNotification('error', 'Update Failed', errorMessage)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!isAdmin) return

    if (!confirm('Are you sure you want to revoke this invitation?')) {
      return
    }

    try {
      setRevokingInviteId(inviteId)
      await deleteInvite(inviteId)

      // Update local state
      setInvites(prev => prev.filter(i => i.id !== inviteId))
      addNotification('post_published', 'Success', 'Invitation revoked successfully')
    } catch (error: any) {
      console.error('Failed to revoke invite:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to revoke invitation'
      addNotification('error', 'Revoke Failed', errorMessage)
    } finally {
      setRevokingInviteId(null)
    }
  }

  const handleInviteSuccess = () => {
    setShowInviteModal(false)
    loadData() // Refresh the invites list
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin" size={20} />
          <span>Loading members...</span>
        </div>
      </div>
    )
  }

  const adminCount = members.filter(m => m.role === 'admin').length

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={24} />
            Workspace Members
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {members.length} {members.length === 1 ? 'member' : 'members'} • {adminCount} {adminCount === 1 ? 'admin' : 'admins'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
          >
            Invite Member
          </button>
        )}
      </div>

      {/* Members List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Members</h3>
        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
              <UserX className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-gray-600">No members found</p>
            </div>
          ) : (
            members.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                canRemove={isAdmin && member.id !== currentUserId && (member.role !== 'admin' || adminCount > 1)}
                isRemoving={removingMemberId === member.id}
                onRemove={() => handleRemoveMember(member.id)}
                onRoleChange={(newRole: 'admin' | 'editor' | 'viewer') => handleRoleChange(member.id, newRole)}
              />
            ))
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {isAdmin && invites.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Pending Invitations ({invites.length})
          </h3>
          <div className="space-y-3">
            {invites.map(invite => {
              const isExpired = new Date(invite.expires_at || '') < new Date()
              const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null

              return (
                <div
                  key={invite.id}
                  className={`p-4 border rounded-lg flex items-center justify-between ${isExpired ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                    }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {invite.email || 'Shareable Link'}
                      </p>
                      {isExpired && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                      <span className="capitalize">{invite.role}</span>
                      {expiresAt && (
                        <>
                          <span>•</span>
                          <span>
                            {isExpired ? 'Expired' : 'Expires'} {expiresAt.toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevokeInvite(invite.id)}
                    disabled={revokingInviteId === invite.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Revoke invitation"
                  >
                    {revokingInviteId === invite.id ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* No Admin Warning */}
      {!isAdmin && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <p className="font-medium text-blue-900">Limited Access</p>
            <p className="text-blue-800 mt-1">
              You can view members but cannot manage them. Contact a workspace admin to manage members and invitations.
            </p>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteMemberModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  )
}
