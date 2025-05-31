// app/api/tools/waf/detector.ts
const kaliToolsUrl = process.env.KALI_TOOLS || "http://kali-tools:5000";
interface WAFDetectionResult {
    isProtected: boolean;
    wafName?: string;
    detectedBy?: string[];
  }
  
  export async function detectWAF(url: string): Promise<WAFDetectionResult> {
    try {
      // Panggil backend Flask untuk WAF detection
      const flaskResponse = await fetch(`${kaliToolsUrl}/api/waf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
  
      if (!flaskResponse.ok) {
        throw new Error(await flaskResponse.text());
      }
  
      const data = await flaskResponse.json();
      
      // Normalisasi response dari backend
      return {
        isProtected: data.protected || false,
        wafName: data.waf_name || 'Unknown',
        detectedBy: data.detected_by || []
      };
      
    } catch (error) {
      console.error('WAF detection failed:', error);
      throw new Error(`WAF detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }