import type { Document } from '../types/index.js';

/**
 * Stored document with metadata
 */
export interface StoredDocument extends Document {
  storedAt: string;
  updatedAt: string;
}

/**
 * Simple in-memory document store
 */
export class DocumentStore {
  private documents: Map<string, StoredDocument> = new Map();

  /**
   * Add or update a document
   */
  add(document: Document): void {
    const now = new Date().toISOString();
    const existing = this.documents.get(document.id);

    const stored: StoredDocument = {
      ...document,
      storedAt: existing?.storedAt || now,
      updatedAt: now,
    };

    this.documents.set(document.id, stored);
  }

  /**
   * Get a document by ID
   */
  get(id: string): StoredDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Check if document exists
   */
  has(id: string): boolean {
    return this.documents.has(id);
  }

  /**
   * Delete a document
   */
  delete(id: string): boolean {
    return this.documents.delete(id);
  }

  /**
   * Get all documents
   */
  all(): StoredDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get document count
   */
  count(): number {
    return this.documents.size;
  }

  /**
   * Get documents by source
   */
  getBySource(source: string): StoredDocument[] {
    return Array.from(this.documents.values())
      .filter(doc => doc.metadata.source === source);
  }

  /**
   * Get documents by type
   */
  getByType(type: Document['type']): StoredDocument[] {
    return Array.from(this.documents.values())
      .filter(doc => doc.type === type);
  }

  /**
   * Get documents by tag
   */
  getByTag(tag: string): StoredDocument[] {
    return Array.from(this.documents.values())
      .filter(doc => doc.metadata.tags?.includes(tag));
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents.clear();
  }

  /**
   * Export store as JSON
   */
  export(): string {
    return JSON.stringify(Array.from(this.documents.entries()));
  }

  /**
   * Import from JSON
   */
  import(json: string): void {
    const entries = JSON.parse(json) as Array<[string, StoredDocument]>;
    this.documents = new Map(entries);
  }
}
