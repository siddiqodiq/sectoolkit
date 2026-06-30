import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Ambil semua parameter pencarian dari permintaan frontend
    const { searchParams } = new URL(request.url)
    
    // Buat URL NVD dan teruskan semua parameternya
    const nvdUrl = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0')
    searchParams.forEach((value, key) => {
      nvdUrl.searchParams.append(key, value)
    })

    const requestOptions: RequestInit = {};
    // Gunakan API key dari environment variable di sisi server (lebih aman)
    const apiKey = process.env.NVD_API_KEY; // Catatan: Tidak perlu NEXT_PUBLIC_ lagi

    // --- TAMBAHKAN LOG DI SINI ---
    if (apiKey) {
      console.log("✅ Using NVD API Key to make the request.");
      requestOptions.headers = {
        'apiKey': apiKey
      };
    } else {
      console.log("⚠️ NVD API Key not found. Making standard request (5/30 seconds).");
    }
    // --- AKHIR DARI LOG ---

    // Lakukan fetch dari server Anda ke NVD
    const nvdResponse = await fetch(nvdUrl.toString(), requestOptions)

    if (!nvdResponse.ok) {
      const errorText = await nvdResponse.text()
      return NextResponse.json({ error: 'Failed to fetch from NVD API', details: errorText }, { status: nvdResponse.status })
    }

    const data = await nvdResponse.json()

    // Kirim kembali data dari NVD ke frontend Anda
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in CVE proxy API:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 })
  }
}