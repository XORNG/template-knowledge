import type { DocumentChunk, DocumentType } from '../types/index.js';

/**
 * Search result
 */
export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  highlights?: string[];
}

/**
 * Search filters
 */
export interface SearchFilters {
  source?: string;
  type?: DocumentType;
  tags?: string[];
  language?: string;
}

/**
 * Simple keyword-based search index
 * 
 * In production, this would be replaced with a vector database
 * or full-text search engine like Elasticsearch.
 */
export class SearchIndex {
  private chunks: Map<string, DocumentChunk> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map();

  /**
   * Add a chunk to the index
   */
  add(chunk: DocumentChunk): void {
    this.chunks.set(chunk.id, chunk);
    
    // Tokenize and index
    const tokens = this.tokenize(chunk.content);
    
    for (const token of tokens) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(chunk.id);
    }
  }

  /**
   * Remove a chunk from the index
   */
  remove(chunkId: string): boolean {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return false;

    // Remove from inverted index
    const tokens = this.tokenize(chunk.content);
    for (const token of tokens) {
      this.invertedIndex.get(token)?.delete(chunkId);
    }

    return this.chunks.delete(chunkId);
  }

  /**
   * Search for chunks
   */
  search(
    query: string,
    limit: number = 10,
    filters?: SearchFilters
  ): SearchResult[] {
    const queryTokens = this.tokenize(query);
    const scores = new Map<string, number>();

    // Calculate scores based on token matches
    for (const token of queryTokens) {
      const matchingChunks = this.invertedIndex.get(token);
      if (matchingChunks) {
        for (const chunkId of matchingChunks) {
          scores.set(chunkId, (scores.get(chunkId) || 0) + 1);
        }
      }
    }

    // Get results and normalize scores
    const maxScore = Math.max(...scores.values(), 1);
    let results: SearchResult[] = [];

    for (const [chunkId, score] of scores) {
      const chunk = this.chunks.get(chunkId);
      if (!chunk) continue;

      // Apply filters
      if (filters) {
        if (filters.source && chunk.metadata.source !== filters.source) continue;
        if (filters.language && chunk.metadata.language !== filters.language) continue;
        if (filters.tags && !filters.tags.some(t => chunk.metadata.tags?.includes(t))) continue;
      }

      const normalizedScore = score / maxScore;
      const highlights = this.getHighlights(chunk.content, queryTokens);

      results.push({
        chunk,
        score: normalizedScore,
        highlights,
      });
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Get chunk count
   */
  count(): number {
    return this.chunks.size;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.chunks.clear();
    this.invertedIndex.clear();
  }

  /**
   * Tokenize text for indexing/searching
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  /**
   * Get highlighted snippets
   */
  private getHighlights(
    content: string,
    queryTokens: string[],
    windowSize: number = 50
  ): string[] {
    const highlights: string[] = [];
    const lowerContent = content.toLowerCase();

    for (const token of queryTokens) {
      let index = lowerContent.indexOf(token);
      
      while (index !== -1 && highlights.length < 3) {
        const start = Math.max(0, index - windowSize);
        const end = Math.min(content.length, index + token.length + windowSize);
        
        let snippet = content.slice(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        
        highlights.push(snippet);
        index = lowerContent.indexOf(token, index + 1);
      }
    }

    return highlights.slice(0, 3);
  }
}
