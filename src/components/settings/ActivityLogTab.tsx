'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { Activity, Filter, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { workspaceApi } from '@/lib/workspace/api-client'
import type { ActivityLogEntry, WorkspaceMember } from '@/types/workspace'

const ITEMS_PER_PAGE = 50

export default function ActivityLogTab() {
  const { workspaceId, userRole } = useAuth()
  const { addNotification } = useNotifications()
  const [activities, setActivities] = useState<ActivityLogEntry[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // Filters
  const [filterUserId, setFilterUserId] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const isAdmin = userRole === 'admin'

  // Load members for filter dropdown
  useEffect(() => {
    if (!workspaceId || !isAdmin) return

    const loadMembers = async () => {
      try {
        const data = await workspaceApi.getMembers()
        setMembers(data)
      } catch (error) {
        console.error('Failed to load members:', error)
      }
    }

    loadMembers()
  }, [workspaceId, isAdmin])

  // Load activity log
  useEffect(() => {
    if (!workspaceId || !isAdmin) return
    loadActivities()
  }, [workspaceId, isAdmin, page, filterUserId, filterAction, filterStartDate, filterEndDate])

  const loadActivities = async () => {
    try {
      setLoading(page === 0)
      setLoadingMore(page > 0)

      const data = await workspaceApi.getActivity({
        userId: filterUserId || undefined,
        action: filterAction || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        limit: ITEMS_PER_PAGE,
        offset: page * ITEMS_PER_PAGE
      })

      setActivities(data.data)
      setTotal(data.total)
      setHasMore(data.hasMore)
    } catch (error: any) {
      console.error('Failed to load activity log:', error)
      addNotification('error', 'Failed to load activity log', error.message || 'Please try again')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleExport = () => {
    try {
      // Convert to CSV
      const headers = ['Date', 'User', 'Action', 'Entity Type', 'Details']
      const rows = activities.map(activity => [
        new Date(activity.created_at).toLocaleString(),
        activity.user_email || activity.user_name || 'Unknown',
        activity.action,
        activity.entity_type,
        JSON.stringify(activity.details)
      ])

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      // Download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      addNotification('post_published', 'Success', 'Activity log exported successfully')
    } catch (error) {
      addNotification('error', 'Export Failed', 'Failed to export activity log')
    }
  }

  const clearFilters = () => {
    setFilterUserId('')
    setFilterAction('')
    setFilterStartDate('')
    setFilterEndDate('')
    setPage(0)
  }

  const formatActionName = (action: string) => {
    return action.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('remove')) return 'text-red-600 bg-red-50'
    if (action.includes('create') || action.includes('add')) return 'text-green-600 bg-green-50'
    if (action.includes('update') || action.includes('change')) return 'text-blue-600 bg-blue-50'
    return 'text-gray-600 bg-gray-50'
  }

  if (!isAdmin) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-semibold text-yellow-900">Access Denied</h3>
          <p className="text-sm text-yellow-800 mt-1">
            Only workspace admins can view the activity log.
          </p>
        </div>
      </div>
    )
  }

  if (loading && page === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin" size={20} />
          <span>Loading activity log...</span>
        </div>
      </div>
    )
  }

  const hasFilters = filterUserId || filterAction || filterStartDate || filterEndDate

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity size={24} />
            Activity Log
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {total} {total === 1 ? 'entry' : 'entries'} total
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${showFilters || hasFilters
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
          >
            <Filter size={18} />
            Filters
            {hasFilters && (
              <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                {[filterUserId, filterAction, filterStartDate, filterEndDate].filter(Boolean).length}
              </span>
            )}
          </button>

          <button
            onClick={handleExport}
            disabled={activities.length === 0}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="filterUser" className="block text-sm font-medium text-gray-700 mb-2">
                User
              </label>
              <select
                id="filterUser"
                value={filterUserId}
                onChange={(e) => { setFilterUserId(e.target.value); setPage(0) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Users</option>
                {members.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.full_name || member.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filterAction" className="block text-sm font-medium text-gray-700 mb-2">
                Action
              </label>
              <input
                id="filterAction"
                type="text"
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(0) }}
                placeholder="e.g., member_added"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="filterStartDate" className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                id="filterStartDate"
                type="date"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setPage(0) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="filterEndDate" className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                id="filterEndDate"
                type="date"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setPage(0) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {hasFilters && (
            <div className="flex justify-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Activity List */}
      <div className="space-y-3">
        {activities.length === 0 ? (
          <div className="p-12 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <Activity className="mx-auto text-gray-400 mb-3" size={48} />
            <p className="text-gray-600">
              {hasFilters ? 'No activities match your filters' : 'No activity recorded yet'}
            </p>
          </div>
        ) : (
          activities.map(activity => (
            <div
              key={activity.id}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(activity.action)}`}>
                      {formatActionName(activity.action)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(activity.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{activity.user_name || activity.user_email}</span>
                    {' '}{formatActionName(activity.action).toLowerCase()}
                    {activity.entity_type && (
                      <span className="text-gray-600"> on {activity.entity_type}</span>
                    )}
                  </p>

                  {activity.details && Object.keys(activity.details).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                        View Details
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                        {JSON.stringify(activity.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Showing {page * ITEMS_PER_PAGE + 1} to {Math.min((page + 1) * ITEMS_PER_PAGE, total)} of {total} entries
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loadingMore}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              <ChevronLeft size={18} />
              Previous
            </button>

            <span className="px-4 text-sm text-gray-600">
              Page {page + 1}
            </span>

            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore || loadingMore}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {loadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      )}
    </div>
  )
}
