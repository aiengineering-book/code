/**
 * Mixed Chinese/English tokenizer
 *
 * Strategy:
 * - English: lowercase, split on non-alphanumeric boundaries, filter stopwords
 * - Chinese: bigram split (single chars + pairs), covers most word boundaries
 *
 * In production, replace with nodejieba / jieba-wasm for more accurate Chinese tokenization
 */

const EN_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'need',
  'dare',
  'ought',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',
  'up',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'out',
  'off',
  'over',
  'under',
  'again',
  'then',
  'and',
  'but',
  'or',
  'nor',
  'so',
  'yet',
  'both',
  'either',
  'neither',
  'not',
  'no',
  'nor',
  'only',
  'own',
  'same',
  'than',
  'too',
  'very',
  'just',
  'as',
  'if',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'him',
  'his',
  'she',
  'her',
  'they',
  'them',
  'their',
  'what',
  'which',
  'who',
  'whom',
]);

/**
 * English tokenizer: lowercase → split → filter stopwords and short words
 */
function tokenizeEn(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((w) => w.length >= 2 && !EN_STOPWORDS.has(w)) ?? []
  );
}

/**
 * Chinese bigram tokenizer: single chars + pairs (covers word boundaries)
 *
 * Example: "人工智能" → ['人', '工', '智', '能', '人工', '工智', '智能']
 */
function tokenizeZh(text: string): string[] {
  const tokens: string[] = [];
  // Consecutive Chinese character block
  const blocks =
    text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g) ?? [];
  for (const block of blocks) {
    for (let i = 0; i < block.length; i++) {
      tokens.push(block[i]!); // single chars
      if (i < block.length - 1) tokens.push(block[i]! + block[i + 1]!); // bigrams
    }
  }
  return tokens;
}

/**
 * Mixed Chinese/English tokenization, returns token array
 */
export function tokenize(text: string): string[] {
  return [...tokenizeEn(text), ...tokenizeZh(text)];
}

/**
 * Pluggable tokenizer interface for injecting custom implementations (e.g., nodejieba)
 */
export type Tokenizer = (text: string) => string[];
