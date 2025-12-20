/**
 * Python Backend HTTP Client
 * 
 * Production-ready axios client configured for the Python FastAPI backend.
 * Features:
 * - Request/response interceptors for auth token injection
 * - Automatic retry with exponential backoff
 * - Error handling with typed responses
 * - Request/response logging in development
 * - Timeout configuration
 */

import axios, {
    AxiosInstance,
    AxiosError,
    AxiosRequestConfig,
    InternalAxiosRequestConfig,
} from 'axios';
import {
    PYTHON_BACKEND_URL,
    API_BASE_URL,
    REQUEST_TIMEOUT,
    RETRY_CONFIG,
} from './config';
import type { ApiError } from './types';

// =============================================================================
// CLIENT CONFIGURATION
// =============================================================================

/**
 * Create configured axios instance for Python backend
 */
function createBackendClient(): AxiosInstance {
    const client = axios.create({
        baseURL: API_BASE_URL,
        timeout: REQUEST_TIMEOUT,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        withCredentials: true,
    });

    // Request interceptor for auth token injection and logging
    client.interceptors.request.use(
        async (config: InternalAxiosRequestConfig) => {
            // Try to get auth token from Supabase client
            const token = await getAuthToken();
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            // Log requests in development
            if (process.env.NODE_ENV === 'development') {
                console.log(
                    `[Python Backend] ${config.method?.toUpperCase()} ${config.url}`,
                    config.data ? { body: config.data } : ''
                );
            }

            return config;
        },
        (error: AxiosError) => {
            console.error('[Python Backend] Request error:', error.message);
            return Promise.reject(error);
        }
    );

    // Response interceptor for error handling and logging
    client.interceptors.response.use(
        (response) => {
            // Log successful responses in development
            if (process.env.NODE_ENV === 'development') {
                console.log(
                    `[Python Backend] Response ${response.status}:`,
                    response.config.url
                );
            }
            return response;
        },
        async (error: AxiosError<ApiError>) => {
            const config = error.config as InternalAxiosRequestConfig & {
                _retryCount?: number;
            };

            // Log errors
            console.error(
                `[Python Backend] Error ${error.response?.status || 'NETWORK'}:`,
                error.message,
                error.response?.data
            );

            // Check if we should retry
            const shouldRetry = shouldRetryRequest(error, config?._retryCount || 0);

            if (shouldRetry && config) {
                config._retryCount = (config._retryCount || 0) + 1;

                // Calculate delay with exponential backoff
                const delay = calculateRetryDelay(config._retryCount);

                console.log(
                    `[Python Backend] Retrying request (${config._retryCount}/${RETRY_CONFIG.maxRetries}) after ${delay}ms`
                );

                await sleep(delay);
                return client(config);
            }

            return Promise.reject(normalizeError(error));
        }
    );

    return client;
}

// =============================================================================
// AUTH TOKEN RETRIEVAL
// =============================================================================

// Cache to track if session has been initialized
let sessionInitialized = false;
let sessionInitPromise: Promise<void> | null = null;

/**
 * Wait for Supabase session to be initialized
 * This helps prevent 401 errors on initial page load when session is still being restored
 */
async function waitForSession(): Promise<void> {
    if (sessionInitialized) return;

    if (sessionInitPromise) {
        return sessionInitPromise;
    }

    sessionInitPromise = (async () => {
        const maxAttempts = 5;
        const delayMs = 100;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const { getSupabaseClient, isSupabaseConfigured } = await import('@/lib/supabase/client');

                if (!isSupabaseConfigured()) {
                    sessionInitialized = true;
                    return;
                }

                const supabase = getSupabaseClient();
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    sessionInitialized = true;
                    return;
                }

                // No session yet, wait and retry
                if (attempt < maxAttempts - 1) {
                    await sleep(delayMs * (attempt + 1));
                }
            } catch {
                // Ignore errors, continue trying
            }
        }

        // Mark as initialized even if no session found (user might not be logged in)
        sessionInitialized = true;
    })();

    return sessionInitPromise;
}

/**
 * Get auth token from Supabase session
 * Uses the singleton Supabase client to avoid multiple GoTrueClient instances
 */
async function getAuthToken(): Promise<string | null> {
    try {
        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
            return null;
        }

        // Wait for session to be initialized on first call
        await waitForSession();

        // Import the singleton Supabase client dynamically to avoid circular dependencies
        const { getSupabaseClient, isSupabaseConfigured } = await import('@/lib/supabase/client');

        if (!isSupabaseConfigured()) {
            return null;
        }

        // Use the singleton client to get session
        const supabase = getSupabaseClient();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('[Python Backend] Error getting session:', error);
            return null;
        }

        return session?.access_token || null;
    } catch (error) {
        console.error('[Python Backend] Failed to get auth token:', error);
        return null; // Don't throw - allow unauthenticated requests for public endpoints
    }
}

/**
 * Reset session state (useful for logout)
 */
export function resetSessionState(): void {
    sessionInitialized = false;
    sessionInitPromise = null;
}

// =============================================================================
// RETRY LOGIC
// =============================================================================

/**
 * Determine if request should be retried
 */
function shouldRetryRequest(error: AxiosError, retryCount: number): boolean {
    // Don't retry if max retries exceeded
    if (retryCount >= RETRY_CONFIG.maxRetries) {
        return false;
    }

    // Don't retry POST/PUT/DELETE requests by default (could cause duplicates)
    const method = error.config?.method?.toUpperCase();
    if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        // Only retry if it's a network error (no response) or server error
        if (error.response?.status && error.response.status < 500) {
            return false;
        }
    }

    // Retry on network errors
    if (!error.response) {
        return true;
    }

    // Retry on specific status codes
    return (RETRY_CONFIG.retryableStatusCodes as readonly number[]).includes(error.response.status);
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: baseDelay * 2^(retryCount - 1)
    const delay = RETRY_CONFIG.baseDelay * Math.pow(2, retryCount - 1);
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    // Cap at maxDelay
    return Math.min(delay + jitter, RETRY_CONFIG.maxDelay);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Normalized error for consistent error handling
 */
export interface BackendError extends Error {
    status?: number;
    code?: string;
    originalError?: AxiosError;
    isNetworkError: boolean;
    isServerError: boolean;
    isClientError: boolean;
}

/**
 * Normalize axios error to BackendError
 */
function normalizeError(error: AxiosError<ApiError>): BackendError {
    const status = error.response?.status;
    const data = error.response?.data;

    const backendError: BackendError = new Error(
        data?.message || data?.error || error.message || 'Unknown error occurred'
    ) as BackendError;

    backendError.status = status;
    backendError.code = data?.code;
    backendError.originalError = error;
    backendError.isNetworkError = !error.response;
    backendError.isServerError = status ? status >= 500 : false;
    backendError.isClientError = status ? status >= 400 && status < 500 : false;

    return backendError;
}

/**
 * Check if error is a BackendError
 */
export function isBackendError(error: unknown): error is BackendError {
    return (
        error instanceof Error &&
        'isNetworkError' in error &&
        'isServerError' in error &&
        'isClientError' in error
    );
}

// =============================================================================
// API REQUEST HELPERS
// =============================================================================

/**
 * Type-safe GET request
 */
export async function get<T>(
    url: string,
    config?: AxiosRequestConfig
): Promise<T> {
    const response = await backendClient.get<T>(url, config);
    return response.data;
}

/**
 * Type-safe POST request
 */
export async function post<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
): Promise<T> {
    const response = await backendClient.post<T>(url, data, config);
    return response.data;
}

/**
 * Type-safe PUT request
 */
export async function put<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
): Promise<T> {
    const response = await backendClient.put<T>(url, data, config);
    return response.data;
}

/**
 * Type-safe PATCH request
 */
export async function patch<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
): Promise<T> {
    const response = await backendClient.patch<T>(url, data, config);
    return response.data;
}

/**
 * Type-safe DELETE request
 */
export async function del<T>(
    url: string,
    config?: AxiosRequestConfig
): Promise<T> {
    const response = await backendClient.delete<T>(url, config);
    return response.data;
}

/**
 * Upload file with multipart/form-data
 */
export async function uploadFile<T>(
    url: string,
    formData: FormData,
    config?: AxiosRequestConfig
): Promise<T> {
    const response = await backendClient.post<T>(url, formData, {
        ...config,
        headers: {
            ...config?.headers,
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
}

// =============================================================================
// SSE / STREAMING SUPPORT
// =============================================================================

/**
 * Create EventSource for SSE streaming endpoints
 * 
 * @param endpoint - API endpoint (relative to base URL)
 * @param body - Request body for POST request
 * @returns EventSource connected to SSE stream
 */
export function createEventSource(
    endpoint: string,
    body?: unknown
): EventSource {
    // For SSE with POST body, we need to use fetch + ReadableStream
    // EventSource only supports GET requests
    // This is a simplified version - for POST SSE, see streamPost below
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    return new EventSource(url);
}

/**
 * Stream POST request with SSE response
 * 
 * @param endpoint - API endpoint
 * @param body - Request body
 * @param onEvent - Callback for each SSE event
 * @param onError - Callback for errors
 * @param onComplete - Callback when stream completes
 */
export async function streamPost<T>(
    endpoint: string,
    body: unknown,
    onEvent: (event: T) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
): Promise<void> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    try {
        // Get auth token
        const token = await getAuthToken();

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                onComplete?.();
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        onEvent(data as T);
                    } catch (parseError) {
                        // Non-JSON line, ignore
                    }
                }
            }
        }
    } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
    }
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Check if Python backend is healthy
 */
export async function checkHealth(): Promise<boolean> {
    try {
        const response = await axios.get(`${PYTHON_BACKEND_URL}/health`, {
            timeout: 5000,
        });
        return response.data?.status === 'healthy';
    } catch {
        return false;
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

/** Configured axios client for Python backend */
export const backendClient = createBackendClient();

/** Backend base URL */
export { PYTHON_BACKEND_URL, API_BASE_URL };
