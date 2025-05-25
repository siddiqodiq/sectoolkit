import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return new Response('session_id is required', { status: 400 });
    }

    console.log(`Stopping SQL scan with session_id: ${session_id}`);

    const flaskResponse = await fetch('http://localhost:5000/api/sqlscan/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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