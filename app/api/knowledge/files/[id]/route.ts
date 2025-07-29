// app/api/knowledge/files/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/db'
import { unlink } from 'fs/promises'
import { deleteDocumentFromChroma } from '@/app/api/chat/utils/chroma'


export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Find the file
    const file = await prisma.knowledge.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Delete physical file
    try {
      await unlink(file.filePath)
    } catch (error) {
      console.error('Error deleting physical file:', error)
    }

    // Delete from ChromaDB
    try {
      await deleteDocumentFromChroma(file.id)
    } catch (chromaError) {
      console.error('Error deleting from ChromaDB:', chromaError)
      // Continue with database deletion even if ChromaDB fails
    }

    // Delete from database
    await prisma.knowledge.delete({
      where: { id: id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting knowledge file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Handle application knowledge base files
    if (id.startsWith('app-')) {
      const mockContent = getMockApplicationContent(id)
      return new Response(mockContent, {
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    // Handle user files
    const file = await prisma.knowledge.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file content
    const fs = await import('fs/promises')
    const content = await fs.readFile(file.filePath, 'utf-8')

    return new Response(content, {
      headers: { 'Content-Type': 'text/plain' }
    })
  } catch (error) {
    console.error('Error getting file content:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getMockApplicationContent(id: string): string {
  switch (id) {
    case 'app-1':
      return `OWASP Top 10 Security Risks

1. Injection
SQL injection, NoSQL injection, OS injection, and LDAP injection flaws occur when untrusted data is sent to an interpreter as part of a command or query.

2. Broken Authentication
Application functions related to authentication and session management are often implemented incorrectly, allowing attackers to compromise passwords, keys, or session tokens.

3. Sensitive Data Exposure
Many web applications and APIs do not properly protect sensitive data, such as financial, healthcare, and PII.

4. XML External Entities (XXE)
Poorly configured XML processors evaluate external entity references within XML documents.

5. Broken Access Control
Restrictions on what authenticated users are allowed to do are often not properly enforced.

[... continued content ...]`

    case 'app-2':
      return `Penetration Testing Methodologies

OWASP Testing Guide
The OWASP Testing Guide provides a comprehensive methodology for testing web application security.

NIST SP 800-115
Technical Guide to Information Security Testing and Assessment

PTES (Penetration Testing Execution Standard)
Pre-engagement Interactions
Intelligence Gathering
Threat Modeling
Vulnerability Analysis
Exploitation
Post Exploitation
Reporting

[... continued content ...]`

    case 'app-3':
      return `Common Vulnerabilities Database

CVE-2023-XXXX: Remote Code Execution in Apache Struts
CVSS Score: 9.8 (Critical)
Description: Critical vulnerability allowing remote code execution...

CVE-2023-YYYY: SQL Injection in Popular CMS
CVSS Score: 8.5 (High)  
Description: SQL injection vulnerability in user authentication...

[... continued content ...]`

    default:
      return 'Content not found'
  }
}