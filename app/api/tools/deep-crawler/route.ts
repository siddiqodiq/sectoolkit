// app/api/tools/deep-crawler/route.ts
import { NextResponse } from 'next/server';

const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";

export async function POST(req: Request) {
  try {
    const { target } = await req.json();
    
    if (!target) {
      return NextResponse.json(
        { error: 'Target URL is required' },
        { status: 400 }
      );
    }

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/deepcrawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target })
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return NextResponse.json(
        { error: error || 'Failed to perform deep crawl' },
        { status: flaskResponse.status }
      );
    }

    // Explicitly decode as UTF-8
    const result = await flaskResponse.json();
    return new NextResponse(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Deep crawler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}