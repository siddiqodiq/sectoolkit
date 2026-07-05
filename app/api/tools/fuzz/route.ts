import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logUserActivity } from '@/lib/logger';
import { NextResponse } from 'next/server';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      try {
        let reqData = {};
        try {
          const reqClone = req.clone();
          reqData = await reqClone.json();
        } catch(e) {}
        const details = typeof reqData === 'object' ? Object.entries(reqData).filter(x => x[0] !== 'session_id' && typeof x[1] === 'string').map(x => x[0] + ': ' + x[1]).join(', ') : '';
        await logUserActivity(session.user.id, 'SCAN_START', 'Tool: fuzz' + (details ? ' - ' + details : ''));
      } catch (e) {}
    }

    const formData = await req.formData();
    const target = formData.get('target') as string;
    const file = formData.get('file') as File;

    if (!target) {
      return new Response('Target URL is required', { status: 400 });
    }

    if (!file) {
      return new Response('Wordlist file is required', { status: 400 });
    }

    if (!target.includes('FUZZ')) {
      return new Response('Target URL must contain FUZZ placeholder', { status: 400 });
    }

    // Forward to Flask backend
    const flaskFormData = new FormData();
    flaskFormData.append('target', target);
    flaskFormData.append('file', file);

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/fuzz`, {
      method: 'POST',
      body: flaskFormData,
      signal: req.signal || undefined,
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return new Response(error || 'Failed to start URL fuzzing', { status: flaskResponse.status });
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
      console.log('URL Fuzzing was aborted by client');
      return new Response('Fuzzing aborted by client', { status: 499 });
    }
    
    console.error('URL Fuzzing error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}