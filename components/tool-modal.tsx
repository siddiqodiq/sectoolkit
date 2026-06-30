"use client"

import dynamic from "next/dynamic"
import { tools } from "@/lib/tools"
import { BaseToolModal } from "@/components/tools/base-tool-modal"

const SubdomainModal = dynamic(() => import("@/components/tools/subdomain-modal").then(mod => mod.SubdomainModal))
const WafModal = dynamic(() => import("@/components/tools/waf-modal").then(mod => mod.WafModal))
const UrlCrawlerModal = dynamic(() => import("./tools/url-crawler-modal").then(mod => mod.UrlCrawlerModal))
const DeepCrawlerModal = dynamic(() => import("./tools/deep-crawler-modal").then(mod => mod.DeepCrawlerModal))
const WaybackDorkingModal = dynamic(() => import("./tools/wayback-dorking-modal").then(mod => mod.WaybackDorkingModal))
const WhoisLookupModal = dynamic(() => import("./tools/whois-lookup-modal").then(mod => mod.WhoisLookupModal))
const NmapScanModal = dynamic(() => import("./tools/nmap-scan-modal").then(mod => mod.NmapScanModal))
const CvssCalculatorModal = dynamic(() => import("./tools/cvss-calculator-modal").then(mod => mod.CvssCalculatorModal))
const CorsScannerModal = dynamic(() => import("./tools/cors-scanner-modal").then(mod => mod.CorsScannerModal))
const GoogleDorkModal = dynamic(() => import("./tools/google-dork-modal").then(mod => mod.GoogleDorkModal))
const OpenRedirectModal = dynamic(() => import("./tools/open-redirect-modal").then(mod => mod.OpenRedirectModal))
const UrlFuzzerModal = dynamic(() => import("./tools/url-fuzzer-modal").then(mod => mod.UrlFuzzerModal))
const XssScanModal = dynamic(() => import("./tools/xss-scan-modal").then(mod => mod.XssScanModal))
const SqlScanModal = dynamic(() => import("./tools/sqlmap-modal").then(mod => mod.SqlScanModal))
const DnsReconModal = dynamic(() => import("./tools/dnsrecon-modal").then(mod => mod.DnsReconModal))
const NucleiScanModal = dynamic(() => import("./tools/nuclei-scan-modal").then(mod => mod.NucleiScanModal))
const ParamEnumModal = dynamic(() => import("./tools/param-enum-modal").then(mod => mod.ParamEnumModal))
const SubdomainTakeoverModal = dynamic(() => import("./tools/sudomain-takeover-modal").then(mod => mod.SubdomainTakeoverModal))
const DecoderEncoderModal = dynamic(() => import("./tools/decoder-encoder-modal").then(mod => mod.DecoderEncoderModal))
const JwtDebuggerModal = dynamic(() => import("./tools/jwt-debugger-modal").then(mod => mod.JwtDebuggerModal))
const LfiScanModal = dynamic(() => import("./tools/lfi-scan-modal").then(mod => mod.LfiScanModal))
const SecurityHeadersModal = dynamic(() => import("./tools/security-headers-modal").then(mod => mod.SecurityHeadersModal))

interface ToolModalProps {
  toolId: string | null
  isOpen: boolean
  onClose: () => void
  onSendToChat?: (content: string) => void
}

export function ToolModal({ toolId, isOpen, onClose, onSendToChat }: ToolModalProps) {
  const selectedTool = tools.find((tool) => tool.id === toolId)

  if (!isOpen && !selectedTool) {
    return null
  }

  // To allow exit animations, we still render the component when isOpen is false, 
  // but if selectedTool is null, we can't render anything useful.
  // The Modal component inside each specific tool modal handles the actual open/close state.
  if (!selectedTool) return null;

  const handleClose = () => {
    onClose()
  }

  switch (selectedTool.name) {
    case "Subdomain Finder":
      return (
        <SubdomainModal 
          tool={selectedTool}
          isOpen={isOpen}
          onClose={handleClose}
          onSendToChat={onSendToChat}
        />
      )
    case "WAF Detector":
      return (
        <WafModal 
          tool={selectedTool}
          isOpen={isOpen}
          onClose={handleClose}
          onSendToChat={onSendToChat}
        />
      )
      case "URL Crawler [FUZZ]": // Add this case
      return (
        <UrlCrawlerModal
          tool={selectedTool}
          isOpen={isOpen}
          onClose={handleClose}
          onSendToChat={onSendToChat}
        />
      )
      case "Deep URL Crawler":
      return (
        <DeepCrawlerModal
          tool={selectedTool}
          isOpen={isOpen}
          onClose={handleClose}
          onSendToChat={onSendToChat}
        />
      )
      case "Wayback Machine Dorking":
    return (
    <WaybackDorkingModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />
    )
    case "Whois Lookup":
  return (
    <WhoisLookupModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />
  )
  case "Nmap Scanner":
  return (
    <NmapScanModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />
  )
  case "CVSS Scoring":
  return (
        <CvssCalculatorModal
          tool={selectedTool}
          isOpen={isOpen}
          onClose={handleClose}
          onSendToChat={onSendToChat}
        />
      )
    case "CORS Misc Scanner":
      return (
        <CorsScannerModal
          tool={selectedTool}
          isOpen={isOpen}
          onClose={handleClose}
          onSendToChat={onSendToChat}
        />
      )
      case "Google Dork":
  return (
    <GoogleDorkModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />
  )
  case "Open Redirect Exploiter":
  return (
    <OpenRedirectModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />
  )
  case "URL Fuzzer":
  return (
    <UrlFuzzerModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
    case "XSS Exploiter":
  return (
    <XssScanModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
    case "SQL Map":
  return (
    <SqlScanModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
    case "Nuclei Scan":
    return (
    <NucleiScanModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
     case "DNS Recon":
  return (
    <DnsReconModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
    case "Web Parameter Enumerator":
      return(
      <ParamEnumModal
      tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
    case "Subdomain Takeover":
      return (
        <SubdomainTakeoverModal tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
     case "Decoder/Encoder":
      return (
        <DecoderEncoderModal tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
     case "JWT Debugger":
      return (
        <JwtDebuggerModal tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
    case "LFI Exploiter":
      return (
        <LfiScanModal tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
     case "Security Headers Checker":
      return (
        <SecurityHeadersModal tool={selectedTool}
      isOpen={isOpen}
      onClose={handleClose}
      onSendToChat={onSendToChat}
    />)
    ;

    default:
      return (
        <BaseToolModal tool={selectedTool} isOpen={isOpen} onClose={handleClose}>
          <div className="p-4">
            <p>This tool is not yet implemented</p>
          </div>
        </BaseToolModal>
      )
  }
}