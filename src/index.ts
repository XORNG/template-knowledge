/**
 * XORNG Template Knowledge
 * 
 * Template for building knowledge retrieval sub-agents.
 */

// Base knowledge provider class
export { BaseKnowledgeProvider } from './base/BaseKnowledgeProvider.js';

// Source abstractions
export {
  BaseSource,
  FileSource,
  ApiSource,
  type SourceResult,
  type SourceContext,
} from './sources/BaseSource.js';

// Types
export * from './types/index.js';

// Utilities
export {
  createKnowledgeServer,
  startKnowledgeProvider,
  type KnowledgeServerOptions,
} from './server.js';
export { 
  DocumentStore,
  type StoredDocument,
} from './utils/store.js';
export {
  SearchIndex,
  type SearchResult,
  type SearchFilters,
} from './utils/search.js';
export {
  ChunkingUtils,
} from './utils/chunking.js';
