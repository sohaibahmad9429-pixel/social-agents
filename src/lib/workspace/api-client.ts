/**
 * Workspace API Client
 * Production-ready client for all workspace operations through Python backend
 * 
 * Features:
 * - Type-safe workspace CRUD operations  
 * - Automatic authentication
 * - Error handling and retries
 * - Request/response validation
 * - Cache invalidation hooks
 */

import { backendClient } from '@/lib/python-backend/client'
import type {
    Workspace,
    UpdateWorkspaceInput,
    WorkspaceMember,
    WorkspaceInvite,
    CreateInviteInput,
    CreateInviteResponse,
    ActivityLogEntry,
    ActivityLogFilters,
    PaginatedActivityLog,
    UpdateMemberRoleInput,
    ApiResponse,
    SuccessResponse
} from '@/types/workspace'

/**
 * Business Settings Interface
 */
export interface BusinessSettings {
    id: string
    workspace_id: string
    business_name: string
    industry: string
    description?: string
    website?: string
    contact_email?: string
    phone?: string
    address?: string
    logo_url?: string
    social_links?: Record<string, string>
    tone_of_voice?: string
    target_audience?: string
    brand_colors?: string[]
    created_at: string
    updated_at: string
    updated_by?: string
}

export interface UpdateBusinessSettingsInput {
    business_name: string
    industry: string
    description?: string
    website?: string
    contact_email?: string
    phone?: string
    address?: string
    logo_url?: string
    social_links?: Record<string, string>
    tone_of_voice?: string
    target_audience?: string
    brand_colors?: string[]
}

/**
 * Workspace API Client Class
 */
class WorkspaceApiClient {
    private baseUrl = '/api/v1/workspace'

    /**
     * Get current workspace details
     */
    async getWorkspace(): Promise<Workspace> {
        const response = await backendClient.get<ApiResponse<Workspace>>(this.baseUrl)

        if (!response.data?.data) {
            throw new Error('No workspace data received')
        }

        return response.data.data
    }

    /**
     * Update workspace settings
     * Admin only
     */
    async updateWorkspace(updates: UpdateWorkspaceInput): Promise<Workspace> {
        const response = await backendClient.patch<ApiResponse<Workspace>>(
            this.baseUrl,
            {
                name: updates.name,
                description: updates.settings?.description,
                maxMembers: updates.max_users
            }
        )

        if (!response.data?.data) {
            throw new Error('Failed to update workspace')
        }

        return response.data.data
    }

    /**
     * Delete/deactivate workspace
     * Admin only - this is a destructive action
     */
    async deleteWorkspace(): Promise<void> {
        await backendClient.delete<SuccessResponse>(this.baseUrl)
    }

    // ============================================================================
    // MEMBERS
    // ============================================================================

    /**
     * Get all workspace members
     */
    async getMembers(role?: 'admin' | 'editor' | 'viewer'): Promise<WorkspaceMember[]> {
        const params = role ? { role } : {}
        const response = await backendClient.get<ApiResponse<WorkspaceMember[]>>(
            `${this.baseUrl}/members`,
            { params }
        )

        return response.data?.data || []
    }

    /**
     * Remove a member from workspace
     * Admin only
     */
    async removeMember(memberId: string): Promise<void> {
        await backendClient.delete<SuccessResponse>(
            `${this.baseUrl}/members/${memberId}`
        )
    }

    /**
     * Update member role
     * Admin only
     */
    async updateMemberRole(input: UpdateMemberRoleInput): Promise<void> {
        await backendClient.patch<SuccessResponse>(
            `${this.baseUrl}/members/${input.userId}/role`,
            { role: input.newRole }
        )
    }

    // ============================================================================
    // INVITATIONS
    // ============================================================================

    /**
     * Get all pending invitations
     * Admin only
     */
    async getInvites(): Promise<WorkspaceInvite[]> {
        const response = await backendClient.get<ApiResponse<WorkspaceInvite[]>>(
            `${this.baseUrl}/invites`
        )

        return response.data?.data || []
    }

    /**
     * Create a new invitation
     * Admin only
     */
    async createInvite(input: CreateInviteInput): Promise<CreateInviteResponse> {
        const response = await backendClient.post<ApiResponse<CreateInviteResponse>>(
            `${this.baseUrl}/invites`,
            {
                email: input.email,
                role: input.role,
                expiresInDays: input.expiresInDays || 7
            }
        )

        if (!response.data?.data) {
            throw new Error('Failed to create invitation')
        }

        return response.data.data
    }

    /**
     * Revoke/delete an invitation
     * Admin only
     */
    async revokeInvite(inviteId: string): Promise<void> {
        await backendClient.delete<SuccessResponse>(
            `${this.baseUrl}/invites`,
            {
                params: { inviteId }
            }
        )
    }

    /**
     * Accept an invitation (public endpoint)
     */
    async acceptInvite(token: string): Promise<void> {
        await backendClient.post<SuccessResponse>(
            `${this.baseUrl}/invites/accept`,
            { token }
        )
    }

    /**
     * Get invitation details by token (public endpoint)
     */
    async getInviteByToken(token: string): Promise<{
        data: WorkspaceInvite & { workspace_name: string }
        isValid: boolean
    }> {
        const response = await backendClient.get<{
            data: WorkspaceInvite & { workspace_name: string }
            isValid: boolean
        }>(`${this.baseUrl}/invites/${token}`)

        return response.data
    }

    // ============================================================================
    // ACTIVITY LOG
    // ============================================================================

    /**
     * Get workspace activity log
     * Admin only
     */
    async getActivity(filters: ActivityLogFilters = {}): Promise<PaginatedActivityLog> {
        const params: Record<string, any> = {
            limit: filters.limit || 50,
            offset: filters.offset || 0
        }

        if (filters.userId) params.userId = filters.userId
        if (filters.action) params.action = filters.action
        if (filters.startDate) params.startDate = filters.startDate
        if (filters.endDate) params.endDate = filters.endDate

        const response = await backendClient.get<PaginatedActivityLog>(
            `${this.baseUrl}/activity`,
            { params }
        )

        return response.data
    }

    // ============================================================================
    // BUSINESS SETTINGS
    // ============================================================================

    /**
     * Get business settings for workspace
     */
    async getBusinessSettings(): Promise<BusinessSettings | null> {
        try {
            const response = await backendClient.get<{
                success: boolean
                data: BusinessSettings | null
            }>(`${this.baseUrl}/business-settings`)

            return response.data?.data ?? null
        } catch (error: any) {
            // Return null if not found (404) - this is expected for new workspaces
            if (error.status === 404 || error.response?.status === 404) {
                return null
            }
            throw error
        }
    }

    /**
     * Update business settings
     */
    async updateBusinessSettings(settings: UpdateBusinessSettingsInput): Promise<BusinessSettings> {
        const response = await backendClient.put<{
            success: boolean
            data: BusinessSettings
        }>(
            `${this.baseUrl}/business-settings`,
            {
                businessName: settings.business_name,
                industry: settings.industry,
                description: settings.description,
                website: settings.website,
                contactEmail: settings.contact_email,
                phone: settings.phone,
                address: settings.address,
                logoUrl: settings.logo_url,
                socialLinks: settings.social_links,
                toneOfVoice: settings.tone_of_voice,
                targetAudience: settings.target_audience,
                brandColors: settings.brand_colors
            }
        )

        if (!response.data?.data) {
            throw new Error('Failed to update business settings')
        }

        return response.data.data
    }

    /**
     * Delete business settings
     */
    async deleteBusinessSettings(): Promise<void> {
        await backendClient.delete<SuccessResponse>(
            `${this.baseUrl}/business-settings`
        )
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    /**
     * Get workspace member count
     */
    async getMemberCount(): Promise<number> {
        const members = await this.getMembers()
        return members.length
    }

    /**
     * Check if workspace is at capacity
     */
    async isWorkspaceFull(): Promise<boolean> {
        const workspace = await this.getWorkspace()
        const memberCount = await this.getMemberCount()
        return memberCount >= workspace.max_users
    }

    /**
     * Check if user can invite more members
     */
    async canInviteMembers(): Promise<{ canInvite: boolean; reason?: string }> {
        const workspace = await this.getWorkspace()
        const memberCount = await this.getMemberCount()

        if (memberCount >= workspace.max_users) {
            return {
                canInvite: false,
                reason: `Workspace is at maximum capacity (${workspace.max_users} members)`
            }
        }

        return { canInvite: true }
    }
}

/**
 * Singleton instance
 */
export const workspaceApi = new WorkspaceApiClient()

/**
 * Export class for testing/mocking
 */
export { WorkspaceApiClient }
