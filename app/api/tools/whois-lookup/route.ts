import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logUserActivity } from '@/lib/logger';
// app/api/tools/whois-lookup/route.ts
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
        await logUserActivity(session.user.id, 'SCAN_START', 'Tool: whois-lookup' + (details ? ' - ' + details : ''));
      } catch (e) {}
    }

    const { domain } = await req.json();
    
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }

    // Forward to Flask backend
    const flaskResponse = await fetch(`${kaliToolsUrl}/api/whois`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
      body: JSON.stringify({ domain })
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return NextResponse.json(
        { error: error || 'Failed to perform WHOIS lookup' },
        { status: flaskResponse.status }
      );
    }

    const result = await flaskResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('WHOIS lookup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}