'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { Save, AlertCircle, Loader2 } from 'lucide-react'
import {
  getWorkspace as getWorkspaceApi,
  updateWorkspace as updateWorkspaceApi,
} from '@/lib/python-backend/api/workspace'
import type { Workspace as BackendWorkspace } from '@/lib/python-backend/types'

// Format date to readable format
const formatDate = (dateString?: string | null) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface FormData {
  name: string
  description: string
  max_users: number
}

interface FieldError {
  field: string
  message: string
}

export default function WorkspaceSettingsTab() {
  const { workspaceId, userRole } = useAuth()
  const { addNotification } = useNotifications()
  const [workspace, setWorkspace] = useState<BackendWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldError[]>([])
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    max_users: 10
  })
  const isAdmin = userRole === 'admin'

  // Load workspace data
  useEffect(() => {
    if (!workspaceId) return

    const loadWorkspace = async () => {
      try {
        setLoading(true)
        setErrors([])
        const data = await getWorkspaceApi()
        setWorkspace(data)
        setFormData({
          name: data.name || '',
          description: (data as any).description || '',
          max_users: (data as any).max_users || data.max_users || 10
        })
      } catch (error: any) {
        console.error('Failed to load workspace:', error)
        addNotification('error', 'Failed to load workspace settings', error.message || 'Please try again')
      } finally {
        setLoading(false)
      }
    }

    loadWorkspace()
  }, [workspaceId, addNotification])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'max_users' ? parseInt(value, 10) || 0 : value
    }))
    // Clear error for this field
    setErrors(prev => prev.filter(err => err.field !== name))
  }

  const validate = (): boolean => {
    const newErrors: FieldError[] = []

    if (!formData.name.trim()) {
      newErrors.push({ field: 'name', message: 'Workspace name is required' })
    } else if (formData.name.length > 255) {
      newErrors.push({ field: 'name', message: 'Workspace name must be less than 255 characters' })
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.push({ field: 'description', message: 'Description must be less than 1000 characters' })
    }

    if (formData.max_users < 1) {
      newErrors.push({ field: 'max_users', message: 'Maximum members must be at least 1' })
    } else if (formData.max_users > 100) {
      newErrors.push({ field: 'max_users', message: 'Maximum members cannot exceed 100' })
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }

  const handleSave = async () => {
    if (!workspaceId || !isAdmin) return

    if (!validate()) {
      addNotification('error', 'Validation Error', 'Please fix the errors before saving')
      return
    }

    try {
      setSaving(true)
      setErrors([])

      const updated = await updateWorkspaceApi({
        name: formData.name,
        description: formData.description,
        maxMembers: formData.max_users,
      })

      setWorkspace(updated)
      addNotification('post_published', 'Success', 'Workspace settings updated successfully')
    } catch (error: any) {
      console.error('Failed to update workspace:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update workspace'
      addNotification('error', 'Update Failed', errorMessage)

      // Parse validation errors if available
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors)
      }
    } finally {
      setSaving(false)
    }
  }

  const getFieldError = (field: string) => {
    return errors.find(err => err.field === field)?.message
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="animate-spin text-teal-500" size={20} />
          <span>Loading workspace settings...</span>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-6 bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl flex items-start gap-3 shadow-sm">
        <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-semibold text-yellow-900">Access Denied</h3>
          <p className="text-sm text-yellow-800 mt-1">Only workspace admins can modify workspace settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Workspace Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-foreground mb-2">
          Workspace Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="My Workspace"
          className={`w-full px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all ${getFieldError('name')
            ? 'border-red-300 bg-red-50/50'
            : 'border-border hover:border-teal-400'
            }`}
          disabled={saving}
        />
        {getFieldError('name') && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} />
            {getFieldError('name')}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">The name of your workspace</p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-semibold text-foreground mb-2">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="Describe your workspace..."
          rows={4}
          className={`w-full px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none transition-all ${getFieldError('description')
            ? 'border-red-300 bg-red-50/50'
            : 'border-border hover:border-teal-400'
            }`}
          disabled={saving}
        />
        {getFieldError('description') && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} />
            {getFieldError('description')}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">
          Optional description of your workspace ({formData.description.length}/1000 characters)
        </p>
      </div>

      {/* Max Users */}
      <div>
        <label htmlFor="max_users" className="block text-sm font-semibold text-foreground mb-2">
          Maximum Members <span className="text-red-500">*</span>
        </label>
        <input
          id="max_users"
          name="max_users"
          type="number"
          min="1"
          max="100"
          value={formData.max_users}
          onChange={handleInputChange}
          className={`w-full px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all ${getFieldError('max_users')
            ? 'border-red-300 bg-red-50/50'
            : 'border-border hover:border-teal-400'
            }`}
          disabled={saving}
        />
        {getFieldError('max_users') && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} />
            {getFieldError('max_users')}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">
          Maximum number of members allowed in this workspace (1-100)
        </p>
      </div>

      {/* Current Stats */}
      {workspace && (
        <div className="p-6 bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 rounded-xl border border-teal-200/50 shadow-sm">
          <h3 className="font-semibold text-teal-900 mb-5 text-base">Workspace Information</h3>
          <div className="grid grid-cols-2 gap-5 text-sm">
            <div className="bg-white/60 backdrop-blur-sm p-3 rounded-lg">
              <p className="text-teal-700 font-medium mb-1.5 text-xs uppercase tracking-wide">Workspace ID</p>
              <p className="text-teal-900 font-mono text-xs break-all">{workspace.id}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-3 rounded-lg">
              <p className="text-teal-700 font-medium mb-1.5 text-xs uppercase tracking-wide">Status</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-teal-900 font-medium">Active</p>
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-3 rounded-lg">
              <p className="text-teal-700 font-medium mb-1.5 text-xs uppercase tracking-wide">Created</p>
              <p className="text-teal-900">
                {formatDate(workspace.created_at)}
              </p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-3 rounded-lg">
              <p className="text-teal-700 font-medium mb-1.5 text-xs uppercase tracking-wide">Last Updated</p>
              <p className="text-teal-900">
                {formatDate(workspace.updated_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !isAdmin}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl hover:from-teal-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30 font-medium"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>Save Changes</span>
            </>
          )}
        </button>

        {saving && (
          <span className="text-sm text-muted-foreground animate-pulse">
            Updating workspace...
          </span>
        )}
      </div>
    </div>
  )
}
