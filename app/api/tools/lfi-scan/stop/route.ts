import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export async function POST(req: Request) {
  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return new Response('session_id is required', { status: 400 });
    }

    console.log(`Stopping LFI scan with session_id: ${session_id}`);

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/lfi-scan/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id }),
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.json();
      console.error('Failed to stop scan:', error);
      return NextResponse.json(
        { error: error.error || 'Failed to stop scan' },
        { status: flaskResponse.status }
      );
    }

    console.log(`Successfully stopped scan with session_id: ${session_id}`);
    return NextResponse.json({ status: 'stopped' });

  } catch (error) {
    console.error('Stop scan error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}