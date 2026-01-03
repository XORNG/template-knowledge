import type { Document, DocumentChunk } from '../types/index.js';

/**
 * Utilities for chunking documents
 */
export class ChunkingUtils {
  private chunkSize: number;
  private overlap: number;

  constructor(chunkSize: number = 1000, overlap: number = 200) {
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  /**
   * Chunk a document
   */
  chunk(document: Document): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const content = document.content;

    if (content.length <= this.chunkSize) {
      // Single chunk for small documents
      chunks.push({
        id: `${document.id}-chunk-0`,
        documentId: document.id,
        content,
        startOffset: 0,
        endOffset: content.length,
        metadata: document.metadata,
      });
      return chunks;
    }

    // Split by semantic boundaries (paragraphs, headers, etc.)
    const sections = this.splitSemantically(content, document.type);

    let currentChunk = '';
    let startOffset = 0;
    let chunkIndex = 0;

    for (const section of sections) {
      if (currentChunk.length + section.length > this.chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          id: `${document.id}-chunk-${chunkIndex}`,
          documentId: document.id,
          content: currentChunk.trim(),
          startOffset,
          endOffset: startOffset + currentChunk.length,
          metadata: document.metadata,
        });

        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-this.overlap);
        startOffset = startOffset + currentChunk.length - this.overlap;
        currentChunk = overlapText;
        chunkIndex++;
      }

      currentChunk += section;
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${document.id}-chunk-${chunkIndex}`,
        documentId: document.id,
        content: currentChunk.trim(),
        startOffset,
        endOffset: startOffset + currentChunk.length,
        metadata: document.metadata,
      });
    }

    return chunks;
  }

  /**
   * Split content by semantic boundaries
   */
  private splitSemantically(content: string, type: Document['type']): string[] {
    switch (type) {
      case 'markdown':
        return this.splitMarkdown(content);
      case 'code':
        return this.splitCode(content);
      default:
        return this.splitParagraphs(content);
    }
  }

  /**
   * Split markdown content
   */
  private splitMarkdown(content: string): string[] {
    // Split by headers and paragraphs
    const sections: string[] = [];
    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      // Check if it's a header
      if (line.match(/^#{1,6}\s/)) {
        if (currentSection.trim()) {
          sections.push(currentSection);
        }
        currentSection = line + '\n';
      } else if (line.trim() === '' && currentSection.trim()) {
        // Empty line - potential section boundary
        currentSection += '\n';
        sections.push(currentSection);
        currentSection = '';
      } else {
        currentSection += line + '\n';
      }
    }

    if (currentSection.trim()) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Split code content
   */
  private splitCode(content: string): string[] {
    // Split by function/class definitions and empty lines
    const sections: string[] = [];
    const lines = content.split('\n');
    let currentSection = '';
    let braceDepth = 0;

    for (const line of lines) {
      // Track brace depth for languages like JS, TS, Java, etc.
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      currentSection += line + '\n';

      // Split at top-level boundaries
      if (braceDepth === 0 && line.trim() === '') {
        if (currentSection.trim()) {
          sections.push(currentSection);
          currentSection = '';
        }
      }
    }

    if (currentSection.trim()) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Split by paragraphs (default)
   */
  private splitParagraphs(content: string): string[] {
    return content
      .split(/\n\n+/)
      .map(p => p.trim() + '\n\n')
      .filter(p => p.trim().length > 0);
  }

  /**
   * Merge small chunks
   */
  mergeSmallChunks(chunks: DocumentChunk[], minSize: number = 100): DocumentChunk[] {
    const merged: DocumentChunk[] = [];
    let current: DocumentChunk | null = null;

    for (const chunk of chunks) {
      if (!current) {
        current = { ...chunk };
        continue;
      }

      if (current.content.length < minSize) {
        // Merge with next chunk
        current = {
          ...current,
          content: current.content + '\n' + chunk.content,
          endOffset: chunk.endOffset,
        };
      } else {
        merged.push(current);
        current = { ...chunk };
      }
    }

    if (current) {
      merged.push(current);
    }

    return merged;
  }
}
