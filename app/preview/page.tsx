"use client"

import { useState, useEffect } from "react"
import { Tool } from "@/lib/tools"
import { WhoisLookupModal } from "@/components/tools/whois-lookup-modal"
import { GoogleDorkModal } from "@/components/tools/google-dork-modal"
import { CvssCalculatorModal } from "@/components/tools/cvss-calculator-modal"
import { DecoderEncoderModal } from "@/components/tools/decoder-encoder-modal"

const dummyTool: Tool = {
  id: "nuclei-scan",
  name: "Nuclei Scan",
  description: "Comprehensive web vulnerability scanner",
  category: "scanning",
  status: "Available"
}

export default function NucleiPreviewPage() {
  const [open, setOpen] = useState(true)

  // Inject style override khusus modal
  useEffect(() => {
    const style = document.createElement("style")
    style.innerHTML = `
      /* Override tinggi modal agar full dan tidak scroll */
      .modal-content {
        max-height: none !important;
        height: auto !important;
        overflow: visible !important;
      }

      /* Card dalam modal tidak dibatasi */
      .modal-content .overflow-y-auto {
        overflow-y: visible !important;
        max-height: none !important;
      }

      /* Panel hasil scan tidak scroll (optional) */
      .modal-content .max-h-96 {
        max-height: none !important;
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <div className="min-h-screen w-full bg-orange-600 text-white p-4">
      <h1 className="text-2xl font-bold mb-4">Nuclei Modal Preview</h1>
      <DecoderEncoderModal
        tool={dummyTool}
        isOpen={open}
        onClose={() => setOpen(false)}
        onSendToChat={(content) => alert("Sent to chat:\n" + content)}
      />
    </div>
  )
}
