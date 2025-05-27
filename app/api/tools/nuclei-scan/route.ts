import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Get form data from the request
    const formData = await req.formData();
    const target = formData.get('target') as string;
    const scanType = formData.get('scan_type') as string || 'single';
    const pattern = formData.get('pattern') as string | null;

    if (!target) {
      return new Response('Target is required', { status: 400 });
    }

    if (scanType === 'single' && !pattern) {
      return new Response('Pattern is required for single scan type', { status: 400 });
    }

    // Prepare JSON payload for Flask backend
    const payload = {
      target,
      scan_type: scanType,
      ...(scanType === 'single' && { pattern })
    };

    // Forward to Flask backend with JSON content type
    const flaskResponse = await fetch('http://localhost:5000/api/nuclei-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: req.signal || undefined,
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return new Response(error || 'Failed to start Nuclei scan', { status: flaskResponse.status });
    }

    // Get session ID and scan type from headers
    const sessionId = flaskResponse.headers.get('X-Session-ID');
    const scanTypeHeader = flaskResponse.headers.get('X-Scan-Type');

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
        'X-Scan-Type': scanTypeHeader || '',
      },
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Nuclei Scan was aborted by client');
      return new Response('Scan aborted by client', { status: 499 });
    }
    
    console.error('Nuclei Scan error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}