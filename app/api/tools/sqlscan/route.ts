import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Ambil FormData dari permintaan
    const formData = await req.formData();

    // Validasi input minimum
    const targetType = formData.get('target_type') as string;
    const target = formData.get('target') as string | null;
    const logfile = formData.get('logfile') as File | null;

    if (!targetType) {
      return new Response('Target type is required', { status: 400 });
    }

    if (targetType === 'url' && !target) {
      return new Response('Target URL is required for URL mode', { status: 400 });
    }

    if (targetType === 'logfile' && !logfile) {
      return new Response('Log file is required for logfile mode', { status: 400 });
    }

    // Forward FormData ke backend Flask
    const flaskResponse = await fetch('http://localhost:5000/api/sqlscan', {
      method: 'POST',
      body: formData,
      signal: req.signal || undefined,
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return new Response(error || 'Failed to start SQL scan', { status: flaskResponse.status });
    }

    // Ambil session ID dari header
    const sessionId = flaskResponse.headers.get('X-Session-ID');

    // Buat pass-through stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Pipe respons Flask ke respons kita
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

    // Kembalikan respons streaming
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'X-Session-ID': sessionId || '',
      },
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('SQL Scan was aborted by client');
      return new Response('Scan aborted by client', { status: 499 });
    }

    console.error('SQL Scan error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}