// app/api/tools/open-redirect/route.ts
import { NextResponse } from 'next/server';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Forward to Flask backend and return the raw text response
    const flaskResponse = await fetch(`${kaliToolsUrl}/api/openredirect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!flaskResponse.ok) {
      const errorText = await flaskResponse.text();
      return NextResponse.json(
        { error: errorText || 'Failed to scan for open redirect' },
        { status: flaskResponse.status }
      );
    }

    // Return the raw text response
    const resultText = await flaskResponse.text();
    return new NextResponse(resultText, {
      headers: { 'Content-Type': 'text/plain' },
    });

  } catch (error) {
    console.error('Open Redirect scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}