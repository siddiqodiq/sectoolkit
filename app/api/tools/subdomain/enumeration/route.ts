// app/api/tools/subdomain/enumeration/route.ts
import { NextResponse } from 'next/server';
import { validateDomain } from '../../utils/validators';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export async function POST(req: Request) {
  try {
    const { domain } = await req.json();
    
    const validation = validateDomain(domain);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 }
      );
    }

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return NextResponse.json(
        { error: error || 'Failed to enumerate subdomains' },
        { status: flaskResponse.status }
      );
    }

    const result = await flaskResponse.json();
    return NextResponse.json({
      success: true,
      subdomains: result.output.split('\n').filter(Boolean),
      rawOutput: result.output
    });

  } catch (error) {
    console.error('Subdomain enumeration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}