// app/api/tools/xss-scan/route.ts
import { NextResponse } from 'next/server';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const mode = formData.get('mode') as string;
    const targetUrl = formData.get('target_url') as string | null;
    const targetFile = formData.get('target_file') as File | null;
    const customPayload = formData.get('custom_payload') as File | null;

    if (!mode) {
      return new Response('Scan mode is required', { status: 400 });
    }

    // Validasi mode dan input yang diperlukan
    if (['1', '2', '3'].includes(mode) && !targetUrl) {
      return new Response('Target URL is required for this mode', { status: 400 });
    }

    if (['4', '5', '6'].includes(mode) && !targetFile) {
      return new Response('Target file is required for this mode', { status: 400 });
    }

    if (['3', '6'].includes(mode) && !customPayload) {
      return new Response('Custom payload file is required for this mode', { status: 400 });
    }

    // Forward ke Flask backend
    const flaskFormData = new FormData();
    flaskFormData.append('mode', mode);
    
    if (targetUrl) flaskFormData.append('target_url', targetUrl);
    if (targetFile) flaskFormData.append('target_file', targetFile);
    if (customPayload) flaskFormData.append('custom_payload', customPayload);

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/xss-scan`, {
      method: 'POST',
      body: flaskFormData,
      signal: req.signal || undefined,
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return new Response(error || 'Failed to start XSS scan', { status: flaskResponse.status });
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
      console.log('XSS Scan was aborted by client');
      return new Response('Scan aborted by client', { status: 499 });
    }
    
    console.error('XSS Scan error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}