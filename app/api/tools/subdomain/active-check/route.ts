import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logUserActivity } from '@/lib/logger';
// app/api/tools/subdomain/active-check/route.ts
import { NextResponse } from 'next/server';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      try {
        let reqData = {};
        try {
          const reqClone = req.clone();
          reqData = await reqClone.json();
        } catch(e) {}
        const details = typeof reqData === 'object' ? Object.entries(reqData).filter(x => x[0] !== 'session_id' && typeof x[1] === 'string').map(x => x[0] + ': ' + x[1]).join(', ') : '';
        await logUserActivity(session.user.id, 'SCAN_START', 'Tool: active-check' + (details ? ' - ' + details : ''));
      } catch (e) {}
    }

    const formData = await req.formData();
    const domain = formData.get('domain') as string | null; // Pastikan nama field 'domain'
    const file = formData.get('file') as File | null;

    if (!domain && !file) {
      return NextResponse.json(
        { error: 'Either domain or file must be provided' },
        { status: 400 }
      );
    }

    const flaskFormData = new FormData();
    
    // Check if session_id is provided in formData or headers
    const sessionId = formData.get('session_id') as string | null || req.headers.get('X-Session-ID');
    if (sessionId) {
      flaskFormData.append('session_id', sessionId);
    }

    if (file) {
      flaskFormData.append('file', file);
    } else if (domain) {
      // Perubahan disini: gunakan 'domain' bukan 'url' untuk konsistensi
      flaskFormData.append('domain', domain);
    }

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/scan/check-active`, {
      method: 'POST',
      headers: { 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
      body: flaskFormData,
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return NextResponse.json(
        { error: error || 'Failed to check active subdomains' },
        { status: flaskResponse.status }
      );
    }

    const result = await flaskResponse.json();
    return NextResponse.json({
      success: true,
      activeUrls: result.results || [],
      count: result.count || 0
    });

  } catch (error) {
    console.error('Active subdomain check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}