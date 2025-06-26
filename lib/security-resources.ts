// data/securityResources.ts
export interface SecurityResource {
  id: string
  name: string
  type: string
  size: string
  filePath?: string
  sourceUrl?: string
  previewAvailable: boolean
}

export const payloadTemplates: SecurityResource[] = [
  {
    id: "PT-001",
    name: "irwanjugabro payloads",
    type: "XSS",
    size: "1 KB",
    filePath: "/payloads/xssirwn.txt",
    sourceUrl: "",
    previewAvailable: true
  },
  {
  id: "PT-008",
    name: "Payloads by CoffinXP",
    type: "All",
    size: "-",
    filePath: "/",
    sourceUrl: "https://github.com/coffinxp/loxs/tree/main/payloads",
    previewAvailable: false
  },
  {
    id: "PT-009",
    name: "Nuclei Templates by CoffinXP",
    type: "Yaml",
    size: "-",
    filePath: "",
    sourceUrl: "https://github.com/coffinxp/nuclei-templates.git"
    , previewAvailable: false
  },
  
  {
  id: "PT-005",
    name: "🔥 💉XSS Bypass Payload 💉🔥 ",    
    type: "XSS",
    size: "2 KB",
    filePath: "/payloads/xssajib.txt",
    sourceUrl: "",
    previewAvailable: true
  },
  {
    id: "PT-002",
     name: "DOS Attack Payload, for input forms to down the server",
    type: "BAC",
    size: "4.99 MB",
    filePath: "/payloads/5mb.txt",
    sourceUrl: "",
    previewAvailable: true
  },
  {
    id: "PT-006",
    name: "LFI Payloads",
    type: "LFI", 
    size: "1 KB",
    filePath: "/payloads/lfi.txt",
    sourceUrl: "",
    previewAvailable: true 
  },
  {
    id: "PT-007",
    name: "Portswigger XSS Payloads",
    type: "XSS",
    size: "-",
    filePath: "",
    sourceUrl: "https://portswigger.net/web-security/cross-site-scripting/cheat-sheet",
    previewAvailable: false
  },
  {
    id: "PT-003",
    name: "Cloudflare WAF Bypass Payload",
    type: "XSS",
    size: "2 KB",
    filePath: "/payloads/cloudflare.txt",
    sourceUrl: "",
    previewAvailable: true
  },
  {
    id: "PT-004",
    name: "Akamai WAF Bypass Payload",
    type: "XSS",
    size: "2 KB",
    filePath: "/payloads/akamai.txt",
    sourceUrl: "",
    previewAvailable: true
  },
  

  
]

export const wordlists: SecurityResource[] = [
  {
    id: "WL-001",
    name: "All in one wordlist from secLists",
    type: "All",
    size: "",
    filePath: "",
    sourceUrl: "https://github.com/danielmiessler/SecLists",
    previewAvailable: true
  },
  {
    id: "WL-002",
    name: "Web common directories",
    type: "Directory",
    size: "",
    filePath: "",
    sourceUrl: "https://github.com/emadshanab/WordLists-20111129",
    previewAvailable: true
  },
  {
    id: "WL-003",
    name: "Rockyou2024 - leaked passwords",
    type: "Password",
    size: "",
    filePath: "",
    sourceUrl: "https://github.com/intelligencegroup-io/RockYou2024",
    previewAvailable: true,
  },
   {
    id: "WL-004",
    name: "David Palma wordlists",
    type: "All",
    size: "",
    filePath: "",
    sourceUrl: "https://github.com/david-palma/wordlists",
    previewAvailable: true,
  },
]