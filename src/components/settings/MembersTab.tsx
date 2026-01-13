'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { Plus, Trash2, Mail, Link as LinkIcon, Copy, Check, Loader2 } from 'lucide-react'
import { getMembers, getInvites, removeMember, updateMemberRole, deleteInvite } from '@/lib/python-backend/api/workspace'
import type { WorkspaceMember, WorkspaceInvite } from '@/lib/python-backend/types'
import MemberCard from './MemberCard'
import InviteMemberModal from './InviteMemberModal'
import { RoleBadge } from '../ui/RoleBadge'

export default function MembersTab() {
  const { user, workspaceId, userRole } = useAuth()
  const { addNotification } = useNotifications()
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)
  const isAdmin = userRole === 'admin'

  // Copy invite link to clipboard
  const handleCopyLink = async (invite: WorkspaceInvite) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const inviteUrl = `${baseUrl}/invite/${invite.token}`

    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedInviteId(invite.id)
      addNotification('post_published', 'Copied', 'Link copied to clipboard!')
      setTimeout(() => setCopiedInviteId(null), 2000)
    } catch (error) {
      addNotification('error', 'Copy Failed', 'Failed to copy link')
    }
  }

  // Load members and pending invites
  useEffect(() => {
    if (!workspaceId) return

    const loadData = async () => {
      try {
        setLoading(true)

        // Load workspace members via Python backend
        const membersData = await getMembers()
        setMembers(membersData)

        // Load pending invites (only if admin)
        if (isAdmin) {
          try {
            const invitesData = await getInvites()
            setPendingInvites(invitesData)
          } catch (e) {
            // User may not have admin access
            console.warn('Could not load invites:', e)
          }
        }
      } catch (error: any) {
        addNotification('error', 'Load Failed', error.message || 'Failed to load workspace members')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [workspaceId, isAdmin, addNotification])

  const handleRemoveMember = async (memberId: string) => {
    if (!workspaceId) return

    const confirmed = confirm('Are you sure you want to remove this member?')
    if (!confirmed) return

    try {
      await removeMember(memberId)
      setMembers(members.filter(m => m.id !== memberId))
      addNotification('post_published', 'Success', 'Member removed successfully')
    } catch (error: any) {
      addNotification('error', 'Failed', error.message || 'Failed to remove member')
    }
  }

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    if (!workspaceId) return

    try {
      await updateMemberRole(memberId, newRole)
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m))
      addNotification('post_published', 'Role Updated', 'Member role updated successfully')
    } catch (error: any) {
      addNotification('error', 'Update Failed', error.message || 'Failed to update member role')
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!workspaceId) return

    const confirmed = confirm('Are you sure you want to revoke this invitation?')
    if (!confirmed) return

    try {
      await deleteInvite(inviteId)
      setPendingInvites(pendingInvites.filter(i => i.id !== inviteId))
      addNotification('post_published', 'Revoked', 'Invitation revoked successfully')
    } catch (error: any) {
      addNotification('error', 'Revoke Failed', error.message || 'Failed to revoke invitation')
    }
  }

  const handleInviteSuccess = async () => {
    // Refresh pending invites
    if (isAdmin) {
      try {
        const invitesData = await getInvites()
        setPendingInvites(invitesData)
      } catch (error) {
        // Silently fail - just won't refresh
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 size={20} className="animate-spin text-teal-500" />
          <span>Loading members...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Current Members Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Workspace Members</h2>
            <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-teal-100 text-teal-700 text-xs font-semibold rounded-full">{members.length}</span>
              <span>member{members.length !== 1 ? 's' : ''} in workspace</span>
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl hover:from-teal-700 hover:to-cyan-700 transition-all shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30 font-medium"
            >
              <Plus size={18} />
              Invite Member
            </button>
          )}
        </div>

        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="text-center py-12 bg-background/40 backdrop-blur-sm rounded-xl border border-border/50">
              <p className="text-muted-foreground">No members yet</p>
            </div>
          ) : (
            members.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                currentUserId={user?.id || ''}
                isAdmin={isAdmin}
                canRemove={isAdmin && member.id !== user?.id}
                isRemoving={false}
                onRemove={() => handleRemoveMember(member.id)}
                onRoleChange={(newRole) => handleRoleChange(member.id, newRole)}
              />
            ))
          )}
        </div>
      </div>

      {/* Pending Invitations Section */}
      {isAdmin && pendingInvites.length > 0 && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">Pending Invitations</h2>
            <p className="text-sm text-muted-foreground mt-1.5">{pendingInvites.length} pending invite{pendingInvites.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="space-y-3">
            {pendingInvites.map(invite => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-5 bg-background/40 backdrop-blur-sm rounded-xl border border-border/50 hover:border-primary/30 transition-all shadow-sm group"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center">
                    {invite.email ? (
                      <Mail size={20} className="text-teal-600" />
                    ) : (
                      <LinkIcon size={20} className="text-cyan-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {invite.email || 'Shareable Link'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {invite.email ? 'Email invitation' : 'Anyone with link can join'}
                    </p>
                  </div>
                  <RoleBadge role={invite.role} size="sm" />
                </div>

                <div className="flex items-center gap-2">
                  {invite.expires_at && new Date(invite.expires_at).getTime() < new Date().getTime() && (
                    <span className="text-xs px-2.5 py-1 bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200 rounded-full font-medium">
                      Expired
                    </span>
                  )}
                  <button
                    onClick={() => handleCopyLink(invite)}
                    className="p-2.5 hover:bg-teal-50 rounded-xl transition-all hover:scale-110"
                    title="Copy invite link"
                  >
                    {copiedInviteId === invite.id ? (
                      <Check size={18} className="text-green-600" />
                    ) : (
                      <Copy size={18} className="text-teal-600" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRevokeInvite(invite.id)}
                    className="p-2.5 hover:bg-red-50 rounded-xl transition-all hover:scale-110"
                    title="Revoke invitation"
                  >
                    <Trash2 size={18} className="text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <InviteMemberModal
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  )
}
