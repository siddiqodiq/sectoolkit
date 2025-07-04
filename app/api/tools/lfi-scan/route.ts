import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const mode = formData.get('mode') as string;
    const url = formData.get('url') as string | null;
    const file = formData.get('file') as File | null;
    const filter = formData.get('filter') as string | null;
    const success_criteria = formData.get('success_criteria') as string | null;
    const payload_file = formData.get('payload_file') as File | null;

    if (!mode) {
      return new Response('Scan mode is required', { status: 400 });
    }

    if (!url && !file) {
      return new Response('Either URL or file is required', { status: 400 });
    }

    const flaskFormData = new FormData();
    flaskFormData.append('mode', mode);
    
    if (url) {
      flaskFormData.append('url', url);
    } else if (file) {
      flaskFormData.append('file', file);
    }

    if (mode === 'advanced') {
      if (filter) flaskFormData.append('filter', filter);
      if (success_criteria) flaskFormData.append('success_criteria', success_criteria);
      if (payload_file) flaskFormData.append('payload_file', payload_file);
    }

    const flaskResponse = await fetch('http://localhost:5000/api/lfi-scan', {
      method: 'POST',
      body: flaskFormData,
      signal: req.signal || undefined,
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return new Response(error || 'Failed to start LFI scan', { status: flaskResponse.status });
    }

    const sessionId = flaskResponse.headers.get('X-Session-ID');

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

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'X-Session-ID': sessionId || '',
      },
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('LFI scan was aborted by client');
      return new Response('Scan aborted by client', { status: 499 });
    }
    
    console.error('LFI scan error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}