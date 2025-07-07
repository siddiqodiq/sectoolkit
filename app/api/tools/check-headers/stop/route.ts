import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return new Response('session_id is required', { status: 400 });
    }

    console.log(`Stopping security headers check with session_id: ${session_id}`);

    const response = await fetch('http://localhost:5000/api/check-headers/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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