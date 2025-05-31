// app/api/tools/cors-scanner/route.ts
import { NextResponse } from 'next/server';
import { stripAnsiCodes } from '@/utils/ansi';

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

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/cors-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return NextResponse.json(
        { error: error || 'Failed to scan for CORS misconfigurations' },
        { status: flaskResponse.status }
      );
    }

    const result = await flaskResponse.json();
    
    // Clean ANSI codes from the raw output
    if (result.raw_output) {
      result.raw_output = stripAnsiCodes(result.raw_output);
    }
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('CORS scanner error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}