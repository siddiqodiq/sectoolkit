import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { Document } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import path from "path";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

const CHROMA_DB_PATH = path.join(process.cwd(), "db", "chroma_langchain_db");

let vectorStore: Chroma | null = null;
let embeddingFunction: OllamaEmbeddings | null = null;

// Initialize embedding function
function getEmbeddingFunction() {
  if (!embeddingFunction) {
    embeddingFunction = new OllamaEmbeddings({
      model: process.env.OLLAMA_EMBEDDINGS_MODEL || "nomic-embed-text",
      baseUrl: process.env.OLLAMA_HOST || "http://localhost:11434",
    });
  }
  return embeddingFunction;
}

export async function initializeChroma() {
  if (!vectorStore) {
    try {
      const embeddings = getEmbeddingFunction();

      // Initialize Chroma with server configuration
      vectorStore = new Chroma(embeddings, {
        collectionName: "documents", // Use "documents" as shown in the logs
        url: "http://localhost:8000",
        collectionMetadata: {
          "hnsw:space": "cosine",
        },
      });

      console.log("✅ ChromaDB initialized successfully");
      return vectorStore;
    } catch (error) {
      console.error("❌ Failed to initialize ChromaDB:", error);
      throw new Error(`ChromaDB initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return vectorStore;
}

// Direct ChromaDB client approach with embedding function
export async function queryChromaDirectly(query: string, nResults: number = 5) {
  try {
    const { ChromaClient } = await import('chromadb');
    
    // Use new ChromaDB client configuration
    const client = new ChromaClient({
      host: "localhost",
      port: 8000,
      ssl: false,
    });

    // Get collections
    const collections = await client.listCollections();
    console.log("📚 Available collections:", collections.map(c => c.name));

    if (collections.length === 0) {
      throw new Error("No collections found in ChromaDB");
    }

    // Use the documents collection (as shown in logs)
    const collection = await client.getCollection({
      name: "documents"
    });

    // Generate embeddings for the query using Ollama
    const embeddings = getEmbeddingFunction();
    const queryEmbedding = await embeddings.embedQuery(query);

    console.log("🔍 Generated query embedding with dimension:", queryEmbedding.length);

    // Query with embeddings instead of queryTexts
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: nResults
    });

    console.log("🔍 Direct query results:", {
      documentsCount: results.documents?.[0]?.length || 0,
      distances: results.distances?.[0] || []
    });

    return {
      documents: results.documents?.[0] || [],
      metadatas: results.metadatas?.[0] || [],
      distances: results.distances?.[0] || []
    };
  } catch (error) {
    console.error("❌ Direct ChromaDB query failed:", error);
    throw error;
  }
}

// Alternative: Use LangChain vector store with proper configuration
export async function queryWithLangChain(query: string, nResults: number = 5) {
  try {
    console.log("🔍 Querying with LangChain vector store...");
    
    const vectorStore = await initializeChroma();
    
    // Use similarity search with score
    const results = await vectorStore.similaritySearchWithScore(query, nResults);
    
    console.log("📄 LangChain results:", results.length, "documents found");
    
    return {
      documents: results.map(([doc, score]) => doc.pageContent),
      metadatas: results.map(([doc, score]) => doc.metadata),
      distances: results.map(([doc, score]) => score)
    };
  } catch (error) {
    console.error("❌ LangChain query failed:", error);
    throw error;
  }
}

export async function getKnowledgeBaseResponse(query: string, chatHistory: string[] = [], id?: string) {
  try {
    console.log("🔍 Querying knowledge base for:", query);
    
    let queryResults;
    
    // Try multiple approaches
    try {
      // First try: Direct ChromaDB with embeddings
      queryResults = await queryChromaDirectly(query, 5);
    } catch (error) {
      console.log("🔄 Direct query failed, trying LangChain approach...");
      try {
        // Second try: LangChain vector store
        queryResults = await queryWithLangChain(query, 5);
      } catch (error2) {
        console.error("❌ All query methods failed");
        throw new Error("Failed to query knowledge base with all available methods");
      }
    }
    
    if (queryResults.documents.length === 0) {
      return "Maaf, saya tidak menemukan informasi yang relevan dalam knowledge base untuk pertanyaan ini.";
    }

    // Format context from query results
    const context = queryResults.documents
      .map((doc, i) => {
        const metadata = queryResults.metadatas[i];
        const source = metadata?.source ? ` (Source: ${metadata.source})` : '';
        const distance = queryResults.distances[i] ? ` (Relevance: ${(1 - queryResults.distances[i]).toFixed(2)})` : '';
        return `Document ${i + 1}${source}${distance}:\n${doc}`;
      })
      .join("\n\n---\n\n");

    console.log("📄 Context length:", context.length);
    console.log("📚 Documents found:", queryResults.documents.length);
    console.log("🎯 Relevance scores:", queryResults.distances);

    // Use Ollama model directly with context
    const model = new ChatOllama({
      baseUrl: process.env.OLLAMA_HOST || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "pentest-ai",
      temperature: 0.3,
    });

    const SYSTEM_TEMPLATE = `You are a penetration testing expert assistant. Use the following context from the knowledge base to answer questions about cybersecurity and penetration testing.

Context from knowledge base:
{context}

Instructions:
- Use the provided context to supplement your knowledge
- If the context doesn't contain relevant information, rely on your general cybersecurity knowledge
- Provide practical and actionable advice
- Be specific about tools, techniques, and methodologies when applicable
- If you're uncertain about something, acknowledge the limitation
- Focus on the most relevant information from the context`;

    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
      HumanMessagePromptTemplate.fromTemplate("Question: {question}"),
    ]);

    // Create chain
    const chain = RunnableSequence.from([
      prompt,
      model,
      new StringOutputParser(),
    ]);

    const response = await chain.invoke({
      context: context,
      question: query
    });

    console.log("✅ Knowledge base response generated");
    return response;
  } catch (error) {
    console.error("❌ Knowledge base error:", error);
    throw new Error(`Failed to query knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Test function with multiple approaches
export async function testChromaConnection() {
  try {
    console.log("🔍 Testing ChromaDB connection...");
    
    // Test 1: Direct ChromaDB
    try {
      const directResult = await queryChromaDirectly("penetration testing", 1);
      console.log("✅ Direct ChromaDB test successful");
      return {
        success: true,
        method: "direct ChromaDB with embeddings",
        documentsFound: directResult.documents.length,
        sampleContent: directResult.documents[0]?.substring(0, 100) || "No content"
      };
    } catch (error) {
      console.log("❌ Direct ChromaDB test failed, trying LangChain...");
    }
    
    // Test 2: LangChain approach
    try {
      const langchainResult = await queryWithLangChain("penetration testing", 1);
      console.log("✅ LangChain ChromaDB test successful");
      return {
        success: true,
        method: "LangChain vector store",
        documentsFound: langchainResult.documents.length,
        sampleContent: langchainResult.documents[0]?.substring(0, 100) || "No content"
      };
    } catch (error) {
      console.log("❌ LangChain test also failed");
    }
    
    return {
      success: false,
      error: "All connection methods failed"
    };
  } catch (error) {
    console.error("❌ ChromaDB connection test failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to check collection info
export async function getCollectionInfo() {
  try {
    const { ChromaClient } = await import('chromadb');
    
    const client = new ChromaClient({
      host: "localhost",
      port: 8000,
      ssl: false,
    });

    const collections = await client.listCollections();
    const info = [];
    
    for (const collectionInfo of collections) {
      try {
        const collection = await client.getCollection({
          name: collectionInfo.name
        });
        
        const count = await collection.count();
        
        // Try to peek at some documents
        let sampleDocs = null;
        try {
          const peek = await collection.peek({ limit: 2 });
          sampleDocs = peek;
        } catch (peekError) {
          console.log(`Cannot peek collection ${collectionInfo.name}:`, peekError);
        }
        
        info.push({
          name: collectionInfo.name,
          id: collectionInfo.id,
          count: count,
          sampleMetadata: sampleDocs?.metadatas?.[0] || null
        });
      } catch (collError) {
        console.error(`Error accessing collection ${collectionInfo.name}:`, collError);
        info.push({
          name: collectionInfo.name,
          id: collectionInfo.id,
          error: collError instanceof Error ? collError.message : 'Unknown error'
        });
      }
    }
    
    return info;
  } catch (error) {
    console.error("❌ Error getting collection info:", error);
    return [];
  }
}

// Helper function to check if ChromaDB server is running
export async function checkChromaDBServer() {
  try {
    const response = await fetch("http://localhost:8000/api/v1/version");
    if (response.ok) {
      const data = await response.json();
      console.log("✅ ChromaDB server is running, version:", data);
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ ChromaDB server not accessible:", error);
    return false;
  }
}

// Start ChromaDB server if not running
export async function ensureChromaDBServer() {
  const isRunning = await checkChromaDBServer();
  
  if (!isRunning) {
    console.log("🚀 Starting ChromaDB server...");
    
    try {
      const { spawn } = await import('child_process');
      
      const chromaProcess = spawn('chroma', [
        'run',
        '--host', 'localhost',
        '--port', '8000',
        '--path', CHROMA_DB_PATH
      ], {
        stdio: 'inherit',
        detached: false
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const isNowRunning = await checkChromaDBServer();
      if (isNowRunning) {
        console.log("✅ ChromaDB server started successfully");
        return chromaProcess;
      } else {
        throw new Error("Failed to start ChromaDB server");
      }
    } catch (error) {
      console.error("❌ Failed to start ChromaDB server:", error);
      throw error;
    }
  }
  
  return null;
}

// ✅ Updated ingestion function using direct ChromaDB
export async function ingestDocumentToChroma(
  content: string,
  metadata: {
    source: string
    fileId: string
    userId: string
    uploadedAt: string
  }
): Promise<number> {
  try {
    console.log(`📄 Starting ingestion for: ${metadata.source}`)
    
    // Use direct ChromaDB instead of LangChain wrapper
    const { ChromaClient } = await import('chromadb');
    
    const client = new ChromaClient({
      host: "localhost",
      port: 8000,
      ssl: false,
    });

    // Get or create collection
    let collection;
    try {
      collection = await client.getCollection({ name: "documents" });
      console.log(`📚 Using existing collection: documents`)
    } catch (error) {
      console.log(`📚 Creating new collection: documents`)
      collection = await client.createCollection({
        name: "documents"        
      });
    }

    // Split document into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const chunks = await textSplitter.splitText(content);
    console.log(`📑 Split into ${chunks.length} chunks`)
    
    if (chunks.length === 0) {
      throw new Error('No text chunks created from content')
    }

    // Generate embeddings for all chunks using Ollama
    console.log(`🔄 Generating embeddings for ${chunks.length} chunks...`)
    const embeddings = getEmbeddingFunction();
    
    const chunkEmbeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        console.log(`📊 Generating embedding for chunk ${index + 1}/${chunks.length}`)
        return await embeddings.embedQuery(chunk)
      })
    );

    console.log(`✅ Generated ${chunkEmbeddings.length} embeddings`)

    // Prepare data for ChromaDB
    const ids = chunks.map((_, i) => `${metadata.fileId}_chunk_${i}_${Date.now()}`);
    const metadatas = chunks.map((_, i) => ({
      source: metadata.source,
      fileId: metadata.fileId,
      userId: metadata.userId,
      uploadedAt: metadata.uploadedAt,
      chunk_id: i,
      chunkCount: chunks.length,
      timestamp: new Date().toISOString()
    }));

    // Add to ChromaDB in batches to avoid memory issues
    const batchSize = 10;
    let totalAdded = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, chunks.length);
      const batchChunks = chunks.slice(i, batchEnd);
      const batchEmbeddings = chunkEmbeddings.slice(i, batchEnd);
      const batchIds = ids.slice(i, batchEnd);
      const batchMetadatas = metadatas.slice(i, batchEnd);

      console.log(`📦 Adding batch ${Math.floor(i/batchSize) + 1}: chunks ${i + 1}-${batchEnd}`)

      await collection.add({
        ids: batchIds,
        embeddings: batchEmbeddings,
        documents: batchChunks,
        metadatas: batchMetadatas
      });

      totalAdded += batchChunks.length;
      console.log(`✅ Added batch: ${batchChunks.length} chunks`)
    }

    console.log(`✅ Successfully ingested ${totalAdded} chunks to ChromaDB for ${metadata.source}`)
    return totalAdded;
    
  } catch (error) {
    console.error('❌ Error ingesting document:', error)
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    throw new Error(`Failed to ingest document: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ✅ Updated delete function with better error handling
export async function deleteDocumentFromChroma(fileId: string): Promise<void> {
  try {
    console.log(`🗑️ Deleting document with fileId: ${fileId}`)
    
    const { ChromaClient } = await import('chromadb')
    const client = new ChromaClient({
      host: "localhost",
      port: 8000,
      ssl: false,
    })
    
    // Check if collection exists
    let collection;
    try {
      collection = await client.getCollection({ name: "documents" })
    } catch (error) {
      console.log(`⚠️ Collection 'documents' not found, nothing to delete`)
      return
    }
    
    // Get all chunks for this file
    const results = await collection.get({
      where: { fileId: fileId }
    })
    
    if (results.ids && results.ids.length > 0) {
      await collection.delete({
        ids: results.ids
      })
      console.log(`✅ Deleted ${results.ids.length} chunks for fileId: ${fileId}`)
    } else {
      console.log(`⚠️ No chunks found for fileId: ${fileId}`)
    }
  } catch (error) {
    console.error('❌ Error deleting document from ChromaDB:', error)
    // Don't throw error for deletion - just log it
    console.log('🔄 Continuing despite ChromaDB deletion error...')
  }
}

// ✅ Test ingestion function
export async function testIngestion() {
  try {
    const testContent = `
# Test Document

This is a test document for penetration testing knowledge base.

## Reconnaissance
- Information gathering
- Port scanning with Nmap
- Service enumeration

## Vulnerability Assessment
- Using automated scanners
- Manual testing techniques
- Code review processes

## Exploitation
- Common attack vectors
- Privilege escalation
- Persistence mechanisms
`

    const testMetadata = {
      source: "test-document.md",
      fileId: "test-" + Date.now(),
      userId: "test-user",
      uploadedAt: new Date().toISOString()
    }

    console.log("🧪 Starting test ingestion...")
    const chunks = await ingestDocumentToChroma(testContent, testMetadata)
    
    console.log("✅ Test ingestion successful!")
    return {
      success: true,
      chunks: chunks,
      metadata: testMetadata
    }
  } catch (error) {
    console.error("❌ Test ingestion failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ✅ Check embedding function availability
export async function testEmbeddingFunction() {
  try {
    console.log("🧪 Testing embedding function...")
    
    const embeddings = getEmbeddingFunction()
    const testQuery = "penetration testing methodology"
    
    console.log(`📊 Generating test embedding for: "${testQuery}"`)
    const embedding = await embeddings.embedQuery(testQuery)
    
    console.log(`✅ Embedding generated successfully!`)
    console.log(`📐 Embedding dimension: ${embedding.length}`)
    console.log(`🔢 Sample values: [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`)
    
    return {
      success: true,
      dimension: embedding.length,
      sampleValues: embedding.slice(0, 10)
    }
  } catch (error) {
    console.error("❌ Embedding function test failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
