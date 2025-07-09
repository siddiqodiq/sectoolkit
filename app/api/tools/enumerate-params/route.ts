import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const pattern = formData.get('pattern') as string;
    const url = formData.get('url') as string | null;
    const file = formData.get('file') as File | null;

    if (!pattern) {
      return new Response('Pattern is required', { status: 400 });
    }

    if (!url && !file) {
      return new Response('Either URL or file is required', { status: 400 });
    }

    const flaskFormData = new FormData();
    flaskFormData.append('pattern', pattern);
    
    if (url) {
      flaskFormData.append('url', url);
    } else if (file) {
      flaskFormData.append('file', file);
    }

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/enumerate-params`, {
      method: 'POST',
      body: flaskFormData,
      signal: req.signal || undefined,
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return new Response(error || 'Failed to start enumeration', { status: flaskResponse.status });
    }

    const sessionId = flaskResponse.headers.get('X-Session-ID');
    const patternHeader = flaskResponse.headers.get('X-Pattern');

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

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

    const response = new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'X-Session-ID': sessionId || '',
        'X-Pattern': patternHeader || '',
      },
    });

    return response;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Enumeration was aborted by client');
      return new Response('Enumeration aborted by client', { status: 499 });
    }
    
    console.error('Enumeration error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}