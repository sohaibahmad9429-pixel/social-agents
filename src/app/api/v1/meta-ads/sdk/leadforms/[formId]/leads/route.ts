import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getPythonBackendUrl } from '@/lib/backend-url';

const PYTHON_BACKEND_URL = getPythonBackendUrl();

interface RouteParams {
    params: Promise<{ formId: string }>;
}

/**
 * GET /api/v1/meta-ads/sdk/leadforms/[formId]/leads
 * Get leads from a specific lead form
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const supabase = await createServerClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { formId } = await params;
        const { searchParams } = new URL(request.url);
        const queryString = searchParams.toString();

        const url = queryString
            ? `${PYTHON_BACKEND_URL}/api/v1/meta-ads/sdk/leadforms/${formId}/leads?${queryString}`
            : `${PYTHON_BACKEND_URL}/api/v1/meta-ads/sdk/leadforms/${formId}/leads`;

        const backendResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await backendResponse.json();
        return NextResponse.json(data, { status: backendResponse.status });
    } catch (error) {
        console.error('Error fetching form leads:', error);
        return NextResponse.json({ error: 'Failed to fetch form leads' }, { status: 500 });
    }
}
