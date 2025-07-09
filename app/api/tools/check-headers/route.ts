import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return new Response('URL is required', { status: 400 });
    }

    const response = await fetch(`${kaliToolsUrl}/api/check-headers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: req.signal || undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(error || 'Failed to check security headers', { status: response.status });
    }

    const sessionId = response.headers.get('X-Session-ID');

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
      const reader = response.body?.getReader();
      if (!reader) {
        writer.close();
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch (error) {
        console.error('Stream error:', error);
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'X-Session-ID': sessionId || '',
      },
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Security headers check was aborted by client');
      return new Response('Check aborted by client', { status: 499 });
    }
    
    console.error('Security headers check error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}