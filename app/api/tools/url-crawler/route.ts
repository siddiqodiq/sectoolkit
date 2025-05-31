// app/api/tools/url-crawler/route.ts
import { NextResponse } from 'next/server';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type');
    
    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      // Forward to Flask backend
      const flaskFormData = new FormData();
      flaskFormData.append('file', file);

      const flaskResponse = await fetch(`${kaliToolsUrl}/api/crawlurl`, {
        method: 'POST',
        body: flaskFormData
      });

      if (!flaskResponse.ok) {
        const error = await flaskResponse.text();
        return NextResponse.json(
          { error: error || 'Failed to crawl URLs from file' },
          { status: flaskResponse.status }
        );
      }

      return NextResponse.json(await flaskResponse.json());
    } else {
      // Handle single domain
      const { domain } = await req.json();
      
      if (!domain) {
        return NextResponse.json(
          { error: 'Domain is required' },
          { status: 400 }
        );
      }

      // Forward to Flask backend
      const flaskResponse = await fetch(`${kaliToolsUrl}/api/crawlurl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });

      if (!flaskResponse.ok) {
        const error = await flaskResponse.text();
        return NextResponse.json(
          { error: error || 'Failed to crawl domain' },
          { status: flaskResponse.status }
        );
      }

      return NextResponse.json(await flaskResponse.json());
    }
  } catch (error) {
    console.error('URL crawler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}