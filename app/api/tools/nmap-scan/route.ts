import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logUserActivity } from '@/lib/logger';
// app/api/tools/nmap-scan/route.ts
import { NextResponse } from 'next/server';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
// Paksa route selalu dinamis (jangan di-cache/di-optimize saat build).
export const dynamic = 'force-dynamic';

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
        await logUserActivity(session.user.id, 'SCAN_START', 'Tool: nmap-scan' + (details ? ' - ' + details : ''));
      } catch (e) {}
    }

    const { target, scan_type, session_id } = await req.json();
    
    if (!target) {
      return NextResponse.json(
        { error: 'Target is required' },
        { status: 400 }
      );
    }

    if (!['1', '2', '3', '4', '5'].includes(scan_type)) {
      return NextResponse.json(
        { error: 'Invalid scan type' },
        { status: 400 }
      );
    }

    // Forward to Flask backend
    const flaskResponse = await fetch(`${kaliToolsUrl}/api/nmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
      body: JSON.stringify({ target, scan_type, session_id })
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return NextResponse.json(
        { error: error || 'Failed to run Nmap scan' },
        { status: flaskResponse.status }
      );
    }

    const result = await flaskResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Nmap scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}