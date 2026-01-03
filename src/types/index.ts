import { z } from 'zod';

/**
 * Document types
 */
export type DocumentType = 'text' | 'markdown' | 'code' | 'json' | 'html' | 'practice' | 'style-guide';

export const DocumentTypeSchema = z.enum(['text', 'markdown', 'code', 'json', 'html', 'practice', 'style-guide']);

/**
 * Document metadata
 */
export interface DocumentMetadata {
  source: string;
  path?: string;
  language?: string;
  version?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export const DocumentMetadataSchema = z.object({
  source: z.string(),
  path: z.string().optional(),
  language: z.string().optional(),
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

/**
 * Document definition
 */
export interface Document {
  id: string;
  type: DocumentType;
  content: string;
  title?: string;
  metadata: DocumentMetadata;
}

export const DocumentSchema = z.object({
  id: z.string(),
  type: DocumentTypeSchema,
  content: z.string(),
  title: z.string().optional(),
  metadata: DocumentMetadataSchema,
});

/**
 * Document chunk for retrieval
 */
export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  title?: string;
  startOffset: number;
  endOffset: number;
  metadata: DocumentMetadata;
}

export const DocumentChunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  content: z.string(),
  title: z.string().optional(),
  startOffset: z.number(),
  endOffset: z.number(),
  metadata: DocumentMetadataSchema,
});

/**
 * Query for knowledge retrieval
 */
export interface KnowledgeQuery {
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

export const KnowledgeQuerySchema = z.object({
  query: z.string(),
  filters: z.object({
    source: z.string().optional(),
    type: DocumentTypeSchema.optional(),
    tags: z.array(z.string()).optional(),
    language: z.string().optional(),
  }).optional(),
  limit: z.number().optional(),
  threshold: z.number().optional(),
});

/**
 * Knowledge retrieval result
 */
export interface KnowledgeResult {
  chunks: Array<{
    chunk: DocumentChunk;
    score: number;
    highlights?: string[];
  }>;
  totalCount: number;
  queryTimeMs: number;
}

export const KnowledgeResultSchema = z.object({
  chunks: z.array(z.object({
    chunk: DocumentChunkSchema,
    score: z.number(),
    highlights: z.array(z.string()).optional(),
  })),
  totalCount: z.number(),
  queryTimeMs: z.number(),
});

/**
 * Knowledge provider configuration
 */
export interface KnowledgeProviderConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  maxResults?: number;
  minScore?: number;
}

export const KnowledgeProviderConfigSchema = z.object({
  chunkSize: z.number().optional().default(1000),
  chunkOverlap: z.number().optional().default(200),
  maxResults: z.number().optional().default(10),
  minScore: z.number().optional().default(0.5),
});

/**
 * Source connection status
 */
export interface SourceStatus {
  name: string;
  connected: boolean;
  documentCount: number;
  lastSync?: string;
  error?: string;
}

export const SourceStatusSchema = z.object({
  name: z.string(),
  connected: z.boolean(),
  documentCount: z.number(),
  lastSync: z.string().optional(),
  error: z.string().optional(),
});
