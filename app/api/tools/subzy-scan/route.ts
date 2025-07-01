import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { domain, https, verify_ssl, hide_fails } = await req.json();

    if (!domain) {
      return new Response('Domain is required', { status: 400 });
    }

    const response = await fetch('http://localhost:5000/api/subzy-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        domain,
        https: https || false,
        verify_ssl: verify_ssl || false,
        hide_fails: hide_fails || false
      }),
      signal: req.signal || undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(error || 'Failed to start subdomain takeover scan', { status: response.status });
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
      console.log('Subdomain takeover scan was aborted by client');
      return new Response('Scan aborted by client', { status: 499 });
    }
    
    console.error('Subdomain takeover scan error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}