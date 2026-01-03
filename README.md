# XORNG Template Knowledge

Template for building knowledge retrieval sub-agents in the XORNG framework.

## Overview

`@xorng/template-knowledge` provides infrastructure for RAG-style sub-agents:

- **BaseKnowledgeProvider** - Base class for knowledge provider sub-agents
- **BaseSource** - Base class for knowledge sources
- **DocumentStore** - In-memory document storage
- **SearchIndex** - Simple keyword-based search
- **ChunkingUtils** - Document chunking utilities

## Installation

```bash
npm install @xorng/template-knowledge
```

## Quick Start

```typescript
import {
  BaseKnowledgeProvider,
  FileSource,
  startKnowledgeProvider,
  type Document,
  type SourceContext,
  type SourceResult,
} from '@xorng/template-knowledge';

// Create a file-based source
class DocsSource extends FileSource {
  constructor() {
    super('docs', 'Documentation files', './docs');
  }

  async connect(context: SourceContext): Promise<void> {
    this.connected = true;
    context.logger.info('Docs source connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async fetchDocuments(context: SourceContext): Promise<SourceResult> {
    const files = await this.listFiles('\\.md$');
    const documents: Document[] = [];

    for (const file of files) {
      const content = await this.readFile(file);
      documents.push({
        id: this.generateId('doc'),
        type: 'markdown',
        content,
        title: file.split('/').pop(),
        metadata: this.createMetadata({ path: file }),
      });
    }

    return { documents };
  }

  async fetchDocument(id: string): Promise<Document | null> {
    return null; // Not implemented for this example
  }

  async getDocumentCount(): Promise<number> {
    const files = await this.listFiles('\\.md$');
    return files.length;
  }
}

// Create the provider
class DocsProvider extends BaseKnowledgeProvider {
  constructor() {
    super({
      name: 'docs-provider',
      version: '1.0.0',
      description: 'Documentation knowledge provider',
      capabilities: ['retrieve', 'search'],
    });

    this.registerSource(new DocsSource());
  }
}

// Start the MCP server
startKnowledgeProvider(new DocsProvider());
```

## Building Sources

### BaseSource

```typescript
abstract class BaseSource {
  constructor(name: string, description: string);

  // Must implement
  abstract connect(context: SourceContext): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract fetchDocuments(context: SourceContext): Promise<SourceResult>;
  abstract fetchDocument(id: string, context: SourceContext): Promise<Document | null>;
  abstract getDocumentCount(): Promise<number>;

  // Helpers
  isConnected(): boolean;
  protected createMetadata(additional?: Partial<DocumentMetadata>): DocumentMetadata;
  protected generateId(prefix?: string): string;
}
```

### FileSource

Pre-built base for file-based sources:

```typescript
abstract class FileSource extends BaseSource {
  constructor(name: string, description: string, basePath: string);

  protected listFiles(pattern?: string): Promise<string[]>;
  protected readFile(filePath: string): Promise<string>;
}
```

### ApiSource

Pre-built base for API-based sources:

```typescript
abstract class ApiSource extends BaseSource {
  constructor(
    name: string,
    description: string,
    baseUrl: string,
    headers?: Record<string, string>
  );

  protected request<T>(endpoint: string, options?: RequestInit): Promise<T>;
}
```

### Example Sources

**GitHub source:**

```typescript
class GitHubSource extends ApiSource {
  constructor(repo: string, token: string) {
    super(
      'github',
      `GitHub repository: ${repo}`,
      'https://api.github.com',
      { Authorization: `token ${token}` }
    );
    this.repo = repo;
  }

  async fetchDocuments(context: SourceContext): Promise<SourceResult> {
    const files = await this.request<Array<{ path: string; sha: string }>>(
      `/repos/${this.repo}/contents/docs`
    );

    const documents: Document[] = [];
    
    for (const file of files) {
      if (!file.path.endsWith('.md')) continue;
      
      const content = await this.request<{ content: string }>(
        `/repos/${this.repo}/contents/${file.path}`
      );
      
      documents.push({
        id: file.sha,
        type: 'markdown',
        content: atob(content.content),
        title: file.path,
        metadata: this.createMetadata({ path: file.path }),
      });
    }

    return { documents };
  }
}
```

**Database source:**

```typescript
class DatabaseSource extends BaseSource {
  private db: Database;

  constructor(connectionString: string) {
    super('database', 'SQL database source');
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    this.db = await connect(this.connectionString);
    this.connected = true;
  }

  async fetchDocuments(): Promise<SourceResult> {
    const rows = await this.db.query('SELECT * FROM documents');
    return {
      documents: rows.map(row => ({
        id: row.id,
        type: 'text',
        content: row.content,
        title: row.title,
        metadata: this.createMetadata({
          tags: row.tags?.split(','),
        }),
      })),
    };
  }
}
```

## Building Knowledge Providers

### BaseKnowledgeProvider

```typescript
abstract class BaseKnowledgeProvider extends BaseSubAgent {
  constructor(
    metadata: SubAgentMetadata,
    config?: SubAgentConfig,
    providerConfig?: KnowledgeProviderConfig
  );

  // Source management
  protected registerSource(source: BaseSource): void;
  async initializeSources(): Promise<void>;
  async syncSources(): Promise<void>;

  // Document management
  async indexDocument(document: Document): Promise<void>;
  getDocument(id: string): StoredDocument | undefined;

  // Search
  async search(query: KnowledgeQuery): Promise<KnowledgeResult>;

  // Built-in tools: 'search', 'retrieve', 'list-sources', 'sync', 'stats'
}
```

### Configuration

```typescript
interface KnowledgeProviderConfig {
  chunkSize?: number;    // Characters per chunk (default: 1000)
  chunkOverlap?: number; // Overlap between chunks (default: 200)
  maxResults?: number;   // Max search results (default: 10)
  minScore?: number;     // Minimum relevance score (default: 0.5)
}
```

## Types

### Document

```typescript
interface Document {
  id: string;
  type: 'text' | 'markdown' | 'code' | 'json' | 'html';
  content: string;
  title?: string;
  metadata: {
    source: string;
    path?: string;
    language?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}
```

### KnowledgeQuery

```typescript
interface KnowledgeQuery {
  query: string;
  filters?: {
    source?: string;
    type?: DocumentType;
    tags?: string[];
    language?: string;
  };
  limit?: number;
  threshold?: number;
}
```

### KnowledgeResult

```typescript
interface KnowledgeResult {
  chunks: Array<{
    chunk: DocumentChunk;
    score: number;
    highlights?: string[];
  }>;
  totalCount: number;
  queryTimeMs: number;
}
```

## Utilities

### DocumentStore

Simple in-memory document storage:

```typescript
const store = new DocumentStore();

store.add(document);
const doc = store.get(id);
const bySource = store.getBySource('github');
const byTag = store.getByTag('api');
store.count();
```

### SearchIndex

Keyword-based search (replace with vector DB in production):

```typescript
const index = new SearchIndex();

index.add(chunk);
const results = index.search('query', limit, filters);
index.count();
```

### ChunkingUtils

Document chunking with semantic boundaries:

```typescript
const chunking = new ChunkingUtils(chunkSize, overlap);

const chunks = chunking.chunk(document);
const merged = chunking.mergeSmallChunks(chunks, minSize);
```

## Production Considerations

For production use, consider:

1. **Vector Database**: Replace `SearchIndex` with Pinecone, Weaviate, Qdrant, or pgvector
2. **Embeddings**: Add embedding generation with OpenAI, Cohere, or local models
3. **Caching**: Add Redis or similar for query caching
4. **Persistence**: Add disk-based storage for `DocumentStore`
5. **Scheduling**: Add cron-based source syncing

## License

MIT
