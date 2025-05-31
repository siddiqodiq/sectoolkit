// app/api/tools/nmap-scan/route.ts
import { NextResponse } from 'next/server';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";

export async function POST(req: Request) {
  try {
    const { target, scan_type } = await req.json();
    
    if (!target) {
      return NextResponse.json(
        { error: 'Target is required' },
        { status: 400 }
      );
    }

    if (!['1', '2', '3', '4', '5'].includes(scan_type)) {
      return NextResponse.json(
        { error: 'Invalid scan type' },
        { status: 400 }
      );
    }

    // Forward to Flask backend
    const flaskResponse = await fetch(`${kaliToolsUrl}/api/nmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, scan_type })
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return NextResponse.json(
        { error: error || 'Failed to run Nmap scan' },
        { status: flaskResponse.status }
      );
    }

    const result = await flaskResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Nmap scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}