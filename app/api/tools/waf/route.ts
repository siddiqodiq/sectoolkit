// app/api/tools/waf/route.ts
import { NextResponse } from 'next/server';
import { detectWAF } from './detector';
import { validateTargetUrl } from '../utils/validators';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
// app/api/tools/waf/route.ts
// app/api/tools/waf/route.ts
export async function POST(req: Request) {
  try {
    const { domain, url } = await req.json();
    
    // Normalisasi input (utamakan domain, fallback ke url)
    const targetDomain = domain || 
                       (url ? url.replace(/^https?:\/\//i, '').split('/')[0] : null);

    if (!targetDomain) {
      return NextResponse.json(
        { error: "Domain is required (provide either 'domain' or 'url' parameter)" },
        { status: 400 }
      );
    }

    // Panggil backend Flask dengan format yang DIA HARUSKAN
    const flaskResponse = await fetch(`${kaliToolsUrl}/api/waf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: targetDomain }) // Pastikan format ini sesuai Flask
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      console.error('Flask error:', error);
      throw new Error(error);
    }

    const result = await flaskResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('WAF detection failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'WAF detection failed' },
      { status: 500 }
    );
  }
}