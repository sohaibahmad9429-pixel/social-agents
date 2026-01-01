/**
 * Backend URL Utility for Server-Side API Routes
 * 
 * Normalizes the Python backend URL for both development and production.
 * Handles Render's internal hostname format.
 */

/**
 * Get the normalized Python backend URL for server-side use.
 * 
 * In production (Render), the PYTHON_BACKEND_URL may be just a hostname
 * like "content-creator-backend-67ah" which needs to be transformed to
 * "https://content-creator-backend-67ah.onrender.com"
 */
export function getPythonBackendUrl(): string {
    let url = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

    // If it already has a protocol, return as-is (with trailing slash removed)
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url.replace(/\/$/, '');
    }

    url = url.trim();

    // Check if it's a localhost URL
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
        return `http://${url}`.replace(/\/$/, '');
    }

    // It's a Render service hostname (no dots means internal service name)
    // Remove any port specification
    url = url.replace(/:\d+$/, '');

    // Add .onrender.com if it doesn't have a domain
    if (!url.includes('.')) {
        url = `${url}.onrender.com`;
    }

    // Use HTTPS for production
    return `https://${url}`;
}

// Export a constant for places that need it at module load time
export const PYTHON_BACKEND_URL = getPythonBackendUrl();
