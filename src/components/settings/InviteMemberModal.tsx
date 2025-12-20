'use client'

import React, { useState } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import { X, Mail, Link2, Copy, Check, Loader2, AlertTriangle } from 'lucide-react'
import { workspaceApi } from '@/lib/workspace/api-client'

interface InviteMemberModalProps {
  onClose: () => void
  onSuccess: () => void
}

type InviteType = 'email' | 'link'

export default function InviteMemberModal({ onClose, onSuccess }: InviteMemberModalProps) {
  const { addNotification } = useNotifications()
  const [inviteType, setInviteType] = useState<InviteType>('email')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('editor')
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [loading, setLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [capacityError, setCapacityError] = useState<string | null>(null)

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isValidEmail = email.trim() === '' || emailRegex.test(email.trim())

  // Check workspace capacity on mount
  React.useEffect(() => {
    const checkCapacity = async () => {
      try {
        const result = await workspaceApi.canInviteMembers()
        if (!result.canInvite) {
          setCapacityError(result.reason || 'Workspace is at capacity')
        }
      } catch (error) {
        console.error('Failed to check capacity:', error)
      }
    }
    checkCapacity()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (inviteType === 'email') {
      if (!email.trim()) {
        addNotification('error', 'Email Required', 'Please enter an email address')
        return
      }
      if (!isValidEmail) {
        addNotification('error', 'Invalid Email', 'Please enter a valid email address')
        return
      }
    }

    try {
      setLoading(true)
      const response = await workspaceApi.createInvite({
        email: inviteType === 'email' ? email.trim() : undefined,
        role,
        expiresInDays
      })

      setInviteUrl(response.inviteUrl)
      addNotification('post_published', 'Invitation Created',
        inviteType === 'email'
          ? `Invitation sent to ${email}`
          : 'Shareable invite link created'
      )

      // If email invite, close modal after success
      if (inviteType === 'email') {
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      }
    } catch (error: any) {
      console.error('Failed to create invite:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create invitation'
      addNotification('error', 'Invitation Failed', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!inviteUrl) return

    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      addNotification('post_published', 'Copied', 'Invite link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      addNotification('error', 'Copy Failed', 'Failed to copy link to clipboard')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Invite Member</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Capacity Warning */}
        {capacityError && (
          <div className="mx-6 mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-medium text-yellow-900">Workspace At Capacity</p>
              <p className="text-yellow-800 mt-1">{capacityError}</p>
            </div>
          </div>
        )}

        {/* Show invite URL if created */}
        {inviteUrl ? (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-2">Invitation Created!</p>
              <p className="text-xs text-green-700">
                Share this link with the person you want to invite:
              </p>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">Invite Link</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-xs font-mono"
                />
                <button
                  onClick={handleCopyLink}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setInviteUrl(null)
                  setEmail('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Create Another
              </button>
              <button
                onClick={() => {
                  onSuccess()
                  onClose()
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Invite Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Invitation Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setInviteType('email')}
                  className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${inviteType === 'email'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <Mail size={24} className={inviteType === 'email' ? 'text-indigo-600' : 'text-gray-400'} />
                  <span className={`text-sm font-medium ${inviteType === 'email' ? 'text-indigo-900' : 'text-gray-700'}`}>
                    Email Invite
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setInviteType('link')}
                  className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${inviteType === 'link'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <Link2 size={24} className={inviteType === 'link' ? 'text-indigo-600' : 'text-gray-400'} />
                  <span className={`text-sm font-medium ${inviteType === 'link' ? 'text-indigo-900' : 'text-gray-700'}`}>
                    Shareable Link
                  </span>
                </button>
              </div>
            </div>

            {/* Email Input (only for email invites) */}
            {inviteType === 'email' && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${!isValidEmail ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  disabled={loading}
                  required
                />
                {!isValidEmail && (
                  <p className="text-xs text-red-600 mt-1">Please enter a valid email address</p>
                )}
              </div>
            )}

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-900 mb-2">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading}
              >
                <option value="viewer">Viewer - Can view content</option>
                <option value="editor">Editor - Can create and edit</option>
                <option value="admin">Admin - Full access</option>
              </select>
            </div>

            {/* Expiration */}
            <div>
              <label htmlFor="expires" className="block text-sm font-medium text-gray-900 mb-2">
                Link Expires In
              </label>
              <select
                id="expires"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading}
              >
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !!capacityError || (inviteType === 'email' && !isValidEmail)}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Invitation</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
