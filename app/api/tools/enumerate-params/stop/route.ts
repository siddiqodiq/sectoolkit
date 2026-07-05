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
        await logUserActivity(session.user.id, 'SCAN_STOP', 'Tool: enumerate-params' + (details ? ' - ' + details : ''));
      } catch (e) {}
    }

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response('session_id is required', { status: 400 });
    }

    console.log(`Stopping enumeration with session_id: ${session_id}`);

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/enumerate-params/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id }),
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.json();
      console.error('Failed to stop enumeration:', error);
      return NextResponse.json(
        { error: error.error || 'Failed to stop enumeration' },
        { status: flaskResponse.status }
      );
    }

    console.log(`Successfully stopped enumeration with session_id: ${session_id}`);
    return NextResponse.json({ status: 'stopped' });

  } catch (error) {
    console.error('Stop enumeration error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}