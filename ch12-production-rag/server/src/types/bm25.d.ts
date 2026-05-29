declare module 'bm25' {
  interface BM25Index {
    addDocument(doc: { id: string; body: string }): void;
    update(): void;
    search(query: string): Array<{ id: string; score: number }>;
  }
  function BM25(): BM25Index;
  export default BM25;
}
