# @tsaibook/bm25

Zero-dependency BM25 full-text search for Node.js and TypeScript. Includes a built-in tokenizer for mixed Chinese/English text.

## Installation

This package lives inside the monorepo and is referenced by other packages via the workspace protocol:

```json
{
  "dependencies": {
    "@tsaibook/bm25": "workspace:*"
  }
}
```

## Quick start

```typescript
import { BM25Index } from '@tsaibook/bm25';

const index = new BM25Index();

index.add('doc1', 'TypeScript is a strongly typed programming language');
index.add('doc2', 'Python is widely used for machine learning');
index.add('doc3', 'TypeScript compiles to JavaScript and runs anywhere');

const results = index.search('TypeScript');
// [
//   { id: 'doc3', score: 1.23 },
//   { id: 'doc1', score: 0.98 },
// ]
```

## API

### `new BM25Index(options?)`

Creates a new index. All options are optional.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `k1` | `number` | `1.5` | Term frequency saturation. Higher values give more weight to repeated terms. |
| `b` | `number` | `0.75` | Document length normalization. `1.0` = fully penalize long docs, `0` = ignore length. |
| `tokenizer` | `(text: string) => string[]` | Built-in | Custom tokenizer. Swap in `nodejieba` or any other tokenizer here. |

The defaults (`k1=1.5, b=0.75`) follow the values from the original Okapi BM25 paper and work well for most use cases.

---

### `index.add(id, text)`

Tokenizes `text` with the configured tokenizer and adds the document to the index.

```typescript
index.add('chunk-001', 'Retrieval-augmented generation combines search with LLMs');
```

### `index.addTokens(id, tokens)`

Adds a document from a pre-tokenized array. Useful when you want to tokenize documents in a batch pipeline and avoid redundant work.

```typescript
const tokens = myTokenizer('some text');
index.addTokens('chunk-001', tokens);
```

### `index.search(query, limit?)`

Tokenizes `query` and returns documents ranked by BM25 score, highest first. `limit` defaults to `10`.

```typescript
const results = index.search('vector database', 5);
// [{ id: string, score: number }, ...]
```

### `index.searchTokens(queryTokens, limit?)`

Same as `search()` but accepts a pre-tokenized query. Matches the `addTokens` pattern when you control tokenization yourself.

```typescript
const results = index.searchTokens(['vector', 'database'], 5);
```

### `index.clear()`

Empties the index. Call this before rebuilding from scratch.

```typescript
index.clear();
await rebuildFromDatabase(index);
```

### `index.size`

Number of documents currently in the index.

### `index.stats`

Returns `{ size, avgdl, terms }` — useful for debugging and monitoring.

```typescript
const { size, avgdl, terms } = index.stats;
console.log(`${size} docs, avg length ${avgdl} tokens, ${terms} unique terms`);
```

---

## Built-in tokenizer

The default tokenizer handles mixed Chinese/English text without any native dependencies.

**English:** lowercased, split on non-alphanumeric boundaries, common stop words removed, tokens shorter than 2 characters dropped.

**Chinese:** bigram segmentation — every single character plus every adjacent pair. For example, `人工智能` produces `['人', '工', '智', '能', '人工', '工智', '智能']`. This covers most word boundaries without a dictionary.

The tokenizer is exported separately if you need it directly:

```typescript
import { tokenize } from '@tsaibook/bm25';

tokenize('TypeScript 类型系统');
// ['typescript', '类', '型', '系', '统', '类型', '型系', '系统']
```

### Plugging in a better Chinese tokenizer

For production workloads with heavy Chinese text, replace the built-in tokenizer with a proper segmenter:

```typescript
import { BM25Index } from '@tsaibook/bm25';
import nodejieba from 'nodejieba';

const index = new BM25Index({
  tokenizer: (text) => nodejieba.cut(text),
});
```

---

## How BM25 works

BM25 scores each document for a query by summing per-term contributions:

```
score(doc, query) = Σ IDF(term) × TF-norm(term, doc)
```

**IDF** (Inverse Document Frequency) rewards terms that appear in fewer documents — rare terms are more informative.

**TF-norm** (normalized term frequency) counts how often a term appears in the document, with two adjustments:
- *Saturation* (`k1`): repeated occurrences matter less and less — the 10th mention of a word adds far less than the 1st.
- *Length normalization* (`b`): longer documents are penalized slightly, so a term appearing once in a 10-word paragraph ranks higher than once in a 10,000-word book.

The formula used here is the smoothed IDF variant from Robertson & Zaragoza (2009), which avoids negative scores when a term appears in more than half the corpus:

```
IDF(t) = log((N - df + 0.5) / (df + 0.5) + 1)
```

---

## Running the tests

```bash
pnpm --filter @tsaibook/bm25 test
```

The test suite covers tokenization, scoring correctness, edge cases (empty index, no match, `clear()` and rebuild), `limit`, custom tokenizers, and sort order guarantees.

---

## Context

This package is part of the companion code repository for the book *TypeScript Full-Stack AI Development*. It replaces the `bm25` npm package (v0.1.1), which breaks under pnpm's isolated `node_modules` structure due to a hardcoded relative path bug in its internals.
