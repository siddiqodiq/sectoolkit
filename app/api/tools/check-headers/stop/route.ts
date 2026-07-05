import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logUserActivity } from '@/lib/logger';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
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
        await logUserActivity(session.user.id, 'SCAN_STOP', 'Tool: check-headers' + (details ? ' - ' + details : ''));
      } catch (e) {}
    }

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response('session_id is required', { status: 400 });
    }

    console.log(`Stopping security headers check with session_id: ${session_id}`);

    const response = await fetch(`${kaliToolsUrl}/api/check-headers/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
      body: JSON.stringify({ session_id }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to stop check:', error);
      return NextResponse.json(
        { error: error.error || 'Failed to stop check' },
        { status: response.status }
      );
    }

    console.log(`Successfully stopped check with session_id: ${session_id}`);
    return NextResponse.json({ status: 'stopped' });

  } catch (error) {
    console.error('Stop check error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}