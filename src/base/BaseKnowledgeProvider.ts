import { Logger } from '@xorng/template-base';
  BaseSubAgent,
  type SubAgentMetadata,
  type SubAgentConfig,
  type ProcessRequest,
  createToolHandler,
} from '@xorng/template-base';
import { z } from 'zod';
import { BaseSource, type SourceContext } from '../sources/BaseSource.js';
import { DocumentStore, type StoredDocument } from '../utils/store.js';
import { SearchIndex, type SearchResult } from '../utils/search.js';
import { ChunkingUtils } from '../utils/chunking.js';
import type {
  Document,
  DocumentChunk,
  KnowledgeQuery,
  KnowledgeResult,
  KnowledgeProviderConfig,
  KnowledgeProviderConfigSchema,
  SourceStatus,
} from '../types/index.js';

/**
 * Base class for knowledge provider sub-agents
 * 
 * Provides knowledge retrieval infrastructure:
 * - Source registration and management
 * - Document storage and indexing
 * - Search and retrieval
 */
export abstract class BaseKnowledgeProvider extends BaseSubAgent {
  protected sources: Map<string, BaseSource> = new Map();
  protected store: DocumentStore;
  protected index: SearchIndex;
  protected chunking: ChunkingUtils;
  protected providerConfig: KnowledgeProviderConfig;

  constructor(
    metadata: SubAgentMetadata,
    config?: SubAgentConfig,
    providerConfig?: KnowledgeProviderConfig
  ) {
    // Ensure 'retrieve' and 'search' capabilities
    const capabilities = new Set(metadata.capabilities);
    capabilities.add('retrieve');
    capabilities.add('search');

    super({ ...metadata, capabilities: Array.from(capabilities) as SubAgentMetadata['capabilities'] }, config);
    
    this.providerConfig = providerConfig || {
      chunkSize: 1000,
      chunkOverlap: 200,
      maxResults: 10,
      minScore: 0.5,
    };

    this.store = new DocumentStore();
    this.index = new SearchIndex();
    this.chunking = new ChunkingUtils(
      this.providerConfig.chunkSize || 1000,
      this.providerConfig.chunkOverlap || 200
    );

    // Register standard tools
    this.registerStandardTools();
  }

  /**
   * Register a knowledge source
   */
  protected registerSource(source: BaseSource): void {
    if (this.sources.has(source.name)) {
      this.logger.warn({ source: source.name }, 'Overwriting existing source');
    }
    this.sources.set(source.name, source);
    this.logger.debug({ source: source.name }, 'Source registered');
  }

  /**
   * Get all registered sources
   */
  getSources(): Map<string, BaseSource> {
    return this.sources;
  }

  /**
   * Initialize and connect all sources
   */
  async initializeSources(): Promise<void> {
    const context: SourceContext = {
      logger: this.logger,
      requestId: crypto.randomUUID(),
    };

    for (const [name, source] of this.sources) {
      try {
        await source.connect(context);
        this.logger.info({ source: name }, 'Source connected');
      } catch (error) {
        this.logger.error({ source: name, error }, 'Failed to connect source');
      }
    }
  }

  /**
   * Sync documents from all sources
   */
  async syncSources(): Promise<void> {
    const context: SourceContext = {
      logger: this.logger,
      requestId: crypto.randomUUID(),
    };

    for (const [name, source] of this.sources) {
      if (!source.isConnected()) {
        this.logger.warn({ source: name }, 'Source not connected, skipping sync');
        continue;
      }

      try {
        const result = await source.fetchDocuments(context);
        
        for (const doc of result.documents) {
          await this.indexDocument(doc);
        }

        this.logger.info({
          source: name,
          documentCount: result.documents.length,
        }, 'Source synced');
      } catch (error) {
        this.logger.error({ source: name, error }, 'Failed to sync source');
      }
    }
  }

  /**
   * Index a document
   */
  async indexDocument(document: Document): Promise<void> {
    // Store the document
    this.store.add(document);

    // Chunk the document
    const chunks = this.chunking.chunk(document);

    // Index each chunk
    for (const chunk of chunks) {
      this.index.add(chunk);
    }

    this.logger.debug({
      documentId: document.id,
      chunkCount: chunks.length,
    }, 'Document indexed');
  }

  /**
   * Search for knowledge
   */
  async search(query: KnowledgeQuery): Promise<KnowledgeResult> {
    const startTime = Date.now();

    const results = this.index.search(
      query.query,
      query.limit || this.providerConfig.maxResults || 10,
      query.filters
    );

    // Filter by score threshold
    const threshold = query.threshold || this.providerConfig.minScore || 0.5;
    const filteredResults = results.filter(r => r.score >= threshold);

    return {
      chunks: filteredResults.map(r => ({
        chunk: r.chunk,
        score: r.score,
        highlights: r.highlights,
      })),
      totalCount: filteredResults.length,
      queryTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get a document by ID
   */
  getDocument(id: string): StoredDocument | undefined {
    return this.store.get(id);
  }

  /**
   * Get source status
   */
  async getSourceStatus(): Promise<SourceStatus[]> {
    const statuses: SourceStatus[] = [];

    for (const [name, source] of this.sources) {
      try {
        const count = await source.getDocumentCount();
        statuses.push({
          name,
          connected: source.isConnected(),
          documentCount: count,
        });
      } catch (error) {
        statuses.push({
          name,
          connected: source.isConnected(),
          documentCount: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return statuses;
  }

  /**
   * Register standard knowledge tools
   */
  private registerStandardTools(): void {
    // Search tool
    this.registerTool(createToolHandler({
      name: 'search',
      description: 'Search the knowledge base',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().describe('Maximum results'),
        filters: z.object({
          source: z.string().optional(),
          type: z.enum(['text', 'markdown', 'code', 'json', 'html']).optional(),
          tags: z.array(z.string()).optional(),
          language: z.string().optional(),
        }).optional(),
      }),
      handler: async (input) => {
        return this.search(input);
      },
    }));

    // Retrieve document tool
    this.registerTool(createToolHandler({
      name: 'retrieve',
      description: 'Retrieve a specific document by ID',
      inputSchema: z.object({
        id: z.string().describe('Document ID'),
      }),
      handler: async (input) => {
        const doc = this.getDocument(input.id);
        return doc || { error: 'Document not found' };
      },
    }));

    // List sources tool
    this.registerTool(createToolHandler({
      name: 'list-sources',
      description: 'List all knowledge sources',
      inputSchema: z.object({}),
      handler: async () => {
        return { sources: await this.getSourceStatus() };
      },
    }));

    // Sync tool
    this.registerTool(createToolHandler({
      name: 'sync',
      description: 'Sync documents from all sources',
      inputSchema: z.object({
        source: z.string().optional().describe('Specific source to sync'),
      }),
      handler: async (input) => {
        if (input.source) {
          const source = this.sources.get(input.source);
          if (!source) {
            return { error: `Source '${input.source}' not found` };
          }
          // Sync specific source
          const context: SourceContext = {
            logger: this.logger,
            requestId: crypto.randomUUID(),
          };
          const result = await source.fetchDocuments(context);
          for (const doc of result.documents) {
            await this.indexDocument(doc);
          }
          return { synced: result.documents.length, source: input.source };
        } else {
          await this.syncSources();
          return { synced: true };
        }
      },
    }));

    // Stats tool
    this.registerTool(createToolHandler({
      name: 'stats',
      description: 'Get knowledge base statistics',
      inputSchema: z.object({}),
      handler: async () => {
        return {
          documentCount: this.store.count(),
          chunkCount: this.index.count(),
          sources: await this.getSourceStatus(),
        };
      },
    }));
  }

  /**
   * Handle process requests
   */
  protected async handleRequest(
    request: ProcessRequest,
    requestId: string
  ): Promise<unknown> {
    if (request.type === 'search') {
      return this.search({
        query: request.content,
        ...request.options as Partial<KnowledgeQuery>,
      });
    }

    // Delegate to tool execution
    return this.executeTool(request.type, request, requestId);
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    await this.initializeSources();
    await this.syncSources();
  }

  /**
   * Shutdown the provider
   */
  async shutdown(): Promise<void> {
    for (const [name, source] of this.sources) {
      try {
        await source.disconnect();
        this.logger.debug({ source: name }, 'Source disconnected');
      } catch (error) {
        this.logger.warn({ source: name, error }, 'Error disconnecting source');
      }
    }
    await super.shutdown();
  }
}
