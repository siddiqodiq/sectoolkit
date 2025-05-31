import { NextResponse } from 'next/server';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Stopping fuzzing with session_id: ${session_id}`);

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/fuzz/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id }),
    });

    if (!flaskResponse.ok) {
      const errorData = await flaskResponse.json();
      console.error('Failed to stop fuzzing:', errorData);
      return new Response(JSON.stringify({ error: errorData.error || 'Failed to stop fuzzing' }), {
        status: flaskResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const responseData = await flaskResponse.json();
    return new Response(JSON.stringify({ message: responseData.message || 'Fuzzing stopped successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error stopping fuzzing:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}