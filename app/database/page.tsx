"use client"
import React from "react"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { Filter, HardDrive, Shield, FileText, List, ArrowLeft } from "lucide-react"
import { CveTable } from "@/components/database/cve-table"
import { PayloadTable } from "@/components/database/payload-table"
import { WordlistTable } from "@/components/database/wordlist-table"
import { SearchHeader } from "@/components/database/search-header"
import { useRouter } from "next/navigation"
import { MainNavbar } from "@/components/main-navbar"


export default function SecurityDatabasePage() {
    const router = useRouter()
  
  // Contoh payload templates
  const payloadTemplates = [
    {
      id: "PT-001",
      name: "XSS Basic Injection",
      type: "XSS",
      language: "JavaScript",
      size: "2 KB"
    },
    // ... other data
  ]

  // Contoh wordlists
  const wordlists = [
    {
      id: "WL-001",
      name: "Common Passwords",
      type: "Password",
      entries: "10,000",
      size: "1.2 MB"
    },
    // ... other data
  ]

  return (
    <div className="flex flex-col min-h-screen w-full bg-background overflow-hidden">
      <MainNavbar />
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto w-full">
          <SearchHeader />
          
          <Tabs defaultValue="cve" className="w-full">
          <TabsList className="grid grid-cols-3 w-full md:w-[400px] glass-effect">
            <TabsTrigger value="cve" className="flex items-center gap-2">
              <Shield className="h-4 w-4" /> <span className="hidden sm:inline">CVE Database</span>
            </TabsTrigger>
            <TabsTrigger value="payloads" className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Payloads</span>
            </TabsTrigger>
            <TabsTrigger value="wordlists" className="flex items-center gap-2">
              <List className="h-4 w-4" /> <span className="hidden sm:inline">Wordlists</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cve" className="mt-6">
            <Card className="glass-effect hover-effect">
              <CardHeader>
                <CardTitle>CVE Database</CardTitle>
                <CardDescription>Kumpulan kerentanan umum dan eksposur</CardDescription>
              </CardHeader>
              <CveTable />
            </Card>
          </TabsContent>

          {/* Payload Templates Tab */}
          <TabsContent value="payloads" className="mt-6">
            <Card className="glass-effect hover-effect">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle>Payload Templates</CardTitle>
                    <CardDescription>Koleksi payload untuk berbagai jenis eksploitasi</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <PayloadTable data={[]} />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col md:flex-row justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Showing 1 to {payloadTemplates.length} of {payloadTemplates.length} entries
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Previous
                  </Button>
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Wordlists Tab */}
          <TabsContent value="wordlists" className="mt-6">
            <Card className="glass-effect hover-effect">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle>Wordlists</CardTitle>
                    <CardDescription>Koleksi wordlist untuk brute-force dan fuzzing</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <WordlistTable data={[]} />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col md:flex-row justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Showing 1 to {wordlists.length} of {wordlists.length} entries
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Previous
                  </Button>
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}