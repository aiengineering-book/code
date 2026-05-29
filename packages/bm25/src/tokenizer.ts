/**
 * 中英文混合分词器
 *
 * 策略：
 * - 英文：小写化后按非字母数字边界切词，并过滤停用词
 * - 中文：按 bigram（单字 + 双字）切分，覆盖大多数词语边界
 *
 * 生产环境可替换为 nodejieba / jieba-wasm 以获得更精准的中文分词
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
 * 英文分词：小写 → 切词 → 过滤停用词和短词
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
 * 中文 bigram 分词：单字 + 双字（覆盖词边界）
 *
 * 例："人工智能" → ['人', '工', '智', '能', '人工', '工智', '智能']
 */
function tokenizeZh(text: string): string[] {
  const tokens: string[] = [];
  // 连续中文字符块
  const blocks =
    text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g) ?? [];
  for (const block of blocks) {
    for (let i = 0; i < block.length; i++) {
      tokens.push(block[i]!); // 单字
      if (i < block.length - 1) tokens.push(block[i]! + block[i + 1]!); // bigram
    }
  }
  return tokens;
}

/**
 * 中英文混合分词，返回 token 数组
 */
export function tokenize(text: string): string[] {
  return [...tokenizeEn(text), ...tokenizeZh(text)];
}

/**
 * 可替换的分词器接口，供业务层注入自定义实现（如 nodejieba）
 */
export type Tokenizer = (text: string) => string[];
