import type { Logger } from '@xorng/template-base';
import type { Document, DocumentChunk, DocumentMetadata } from '../types/index.js';

/**
 * Result from a source
 */
export interface SourceResult {
  documents: Document[];
  metadata?: Record<string, unknown>;
}

/**
 * Context for source operations
 */
export interface SourceContext {
  logger: Logger;
  requestId: string;
}

/**
 * Base class for knowledge sources
 * 
 * Sources are responsible for:
 * - Connecting to data stores
 * - Fetching documents
 * - Syncing updates
 */
export abstract class BaseSource {
  public readonly name: string;
  public readonly description: string;
  protected connected: boolean = false;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  /**
   * Connect to the source
   */
  abstract connect(context: SourceContext): Promise<void>;

  /**
   * Disconnect from the source
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Fetch documents from the source
   */
  abstract fetchDocuments(context: SourceContext): Promise<SourceResult>;

  /**
   * Fetch a specific document by ID
   */
  abstract fetchDocument(id: string, context: SourceContext): Promise<Document | null>;

  /**
   * Get document count
   */
  abstract getDocumentCount(): Promise<number>;

  /**
   * Create base metadata for documents from this source
   */
  protected createMetadata(additional?: Partial<DocumentMetadata>): DocumentMetadata {
    return {
      source: this.name,
      createdAt: new Date().toISOString(),
      ...additional,
    };
  }

  /**
   * Generate a document ID
   */
  protected generateId(prefix?: string): string {
    const id = crypto.randomUUID();
    return prefix ? `${prefix}-${id}` : id;
  }
}

/**
 * File-based source
 */
export abstract class FileSource extends BaseSource {
  protected basePath: string;

  constructor(name: string, description: string, basePath: string) {
    super(name, description);
    this.basePath = basePath;
  }

  /**
   * List files in the source directory
   */
  protected async listFiles(pattern?: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const files: string[] = [];
    
    async function walk(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          if (!pattern || new RegExp(pattern).test(entry.name)) {
            files.push(fullPath);
          }
        }
      }
    }

    await walk(this.basePath);
    return files;
  }

  /**
   * Read file content
   */
  protected async readFile(filePath: string): Promise<string> {
    const fs = await import('fs/promises');
    return fs.readFile(filePath, 'utf-8');
  }
}

/**
 * API-based source
 */
export abstract class ApiSource extends BaseSource {
  protected baseUrl: string;
  protected headers: Record<string, string>;

  constructor(
    name: string,
    description: string,
    baseUrl: string,
    headers?: Record<string, string>
  ) {
    super(name, description);
    this.baseUrl = baseUrl;
    this.headers = headers || {};
  }

  /**
   * Make an API request
   */
  protected async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.headers,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as T;
  }
}
