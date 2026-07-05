import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logUserActivity } from '@/lib/logger';
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
        await logUserActivity(session.user.id, 'SCAN_STOP', 'Tool: wayback-dorking' + (details ? ' - ' + details : ''));
      } catch (e) {}
    }

    const { session_id } = await req.json();

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/wayback/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
      body: JSON.stringify({ session_id }),
    });

    if (!flaskResponse.ok) {
      const errorData = await flaskResponse.json().catch(() => ({ error: 'Failed to stop scan' }));
      return NextResponse.json(
        { error: errorData.error || 'Failed to stop scan' },
        { status: flaskResponse.status }
      );
    }

    const data = await flaskResponse.json();
    return NextResponse.json({ success: true, message: data.message });
  } catch (error) {
    console.error('Stop wayback scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
