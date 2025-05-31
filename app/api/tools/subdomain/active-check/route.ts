// app/api/tools/subdomain/active-check/route.ts
import { NextResponse } from 'next/server';
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const domain = formData.get('domain') as string | null; // Pastikan nama field 'domain'
    const file = formData.get('file') as File | null;

    if (!domain && !file) {
      return NextResponse.json(
        { error: 'Either domain or file must be provided' },
        { status: 400 }
      );
    }

    const flaskFormData = new FormData();
    
    if (file) {
      flaskFormData.append('file', file);
    } else if (domain) {
      // Perubahan disini: gunakan 'domain' bukan 'url' untuk konsistensi
      flaskFormData.append('domain', domain);
    }

    const flaskResponse = await fetch(`${kaliToolsUrl}/api/scan/check-active`, {
      method: 'POST',
      body: flaskFormData,
    });

    if (!flaskResponse.ok) {
      const error = await flaskResponse.text();
      return NextResponse.json(
        { error: error || 'Failed to check active subdomains' },
        { status: flaskResponse.status }
      );
    }

    const result = await flaskResponse.json();
    return NextResponse.json({
      success: true,
      activeUrls: result.results || [],
      count: result.count || 0
    });

  } catch (error) {
    console.error('Active subdomain check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}