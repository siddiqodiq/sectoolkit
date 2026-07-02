import { NextResponse } from 'next/server';

const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";

export async function POST(req: Request) {
  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/crawlurl/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id })
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return NextResponse.json(
        { error: error || 'Failed to stop crawler' },
        { status: flaskResponse.status }
      );
    }

    return NextResponse.json(await flaskResponse.json());
  } catch (error) {
    console.error('Stop URL crawler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
