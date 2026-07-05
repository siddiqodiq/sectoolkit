import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logUserActivity } from '@/lib/logger';
import { NextResponse } from 'next/server';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
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
        await logUserActivity(session.user.id, 'SCAN_STOP', 'Tool: sqlscan' + (details ? ' - ' + details : ''));
      } catch (e) {}
    }

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response('session_id is required', { status: 400 });
    }

    console.log(`Stopping SQL scan with session_id: ${session_id}`);

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/sqlscan/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
      body: JSON.stringify({ session_id }),
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.json();
      console.error('Failed to stop SQL scan:', error);
      return NextResponse.json(
        { error: error.error || 'Failed to stop scan' },
        { status: flaskResponse.status }
      );
    }

    console.log(`Successfully stopped SQL scan with session_id: ${session_id}`);
    return NextResponse.json({ status: 'stopped' });

  } catch (error) {
    console.error('Stop SQL scan error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}