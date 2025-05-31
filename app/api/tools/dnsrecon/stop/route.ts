import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";

export async function POST(req: Request) {
  try {
    const { domain } = await req.json();

    if (!domain) {
      return new Response('Domain is required', { status: 400 });
    }

    // Validate domain format
    if (!/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(domain)) {
      return new Response('Invalid domain format', { status: 400 });
    }

    // Forward to Flask backend
    const flaskResponse = await fetch(`${kaliToolsUrl}/api/dnsrecon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
      signal: req.signal || undefined,
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return new Response(error || 'Failed to start DNS reconnaissance', { 
        status: flaskResponse.status 
      });
    }

    // Get session ID from headers
    const sessionId = flaskResponse.headers.get('X-Session-ID');

    // Create a pass-through stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Pipe the Flask response to our response
    (async () => {
      const reader = flaskResponse.body?.getReader();
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

    // Return the streaming response
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'X-Session-ID': sessionId || '',
      },
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('DNS Recon was aborted by client');
      return new Response('Scan aborted by client', { status: 499 });
    }
    
    console.error('DNS Recon error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}