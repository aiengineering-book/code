// packages/server/src/lib/agent/tools/design-examples.ts
// #book ch14-design-examples

// ch14-tool-calling/server/src/lib/agent/tools/design-examples.ts
// 原则一：必填参数尽量少，可选参数给明确的默认值说明
const searchTool = {
  name: 'search_documents',
  description: '在知识库中搜索相关文档',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词或问题',
      },
      limit: {
        type: 'number',
        description: '返回结果数量，默认 5，最大 20',
      },
      documentType: {
        type: 'string',
        enum: ['pdf', 'markdown', 'html', 'all'],
        description: '过滤文档类型，默认 "all" 表示不过滤',
      },
    },
    required: ['query'], // 只有 query 是必填
  },
};

// 原则二：用 enum 约束有限的选项，而非 string
const badEmailPriority = {
  priority: { type: 'string', description: '优先级：低、中、高' },
};
const goodEmailPriority = {
  priority: {
    type: 'string',
    enum: ['low', 'medium', 'high'],
    description: '邮件优先级',
  },
};

// 原则三：数值参数明确范围和单位
const badTimeout = {
  timeout: { type: 'number', description: '超时时间' },
};
const goodTimeout = {
  timeoutSeconds: {
    type: 'number',
    description: '超时时间，单位：秒，范围 1-300，默认 30',
  },
};

// 原则四：避免过于宽泛的 object 类型参数
// 模型很难知道该传什么结构
const badConfig = {
  config: { type: 'object', description: '配置项' },
};
// 应该拆分成具体的字段
const goodConfig = {
  temperature: { type: 'number', description: '温度设置，0.0-2.0' },
  maxTokens: { type: 'number', description: '最大输出 Token 数' },
};

// 原则五：工具名称用下划线分隔的动词+名词格式
// 好：create_todo, get_user_profile, search_web, send_email
// 差：todo, user, search, email

// 原则六：返回结果在描述中说明，让模型知道拿到的是什么
const weatherTool = {
  name: 'get_weather',
  description: `获取指定城市的当前天气。
返回 JSON：{ city, temperature（摄氏度）, humidity（%）, condition（晴/多云/雨/雪）, forecast（未来3天）}`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      city: {
        type: 'string',
        description: '城市名称，支持中文和英文，如 "北京" 或 "Beijing"',
      },
    },
    required: ['city'],
  },
};

// 原则七：工具数量控制在 10 个以内
// 工具太多会稀释模型的注意力，降低选择准确性
// 如果工具很多，考虑按场景分组，只在需要时注入对应的工具集
// #endbook

// 仅用于说明，防止 TypeScript 报"未使用变量"
void [
  searchTool,
  badEmailPriority,
  goodEmailPriority,
  badTimeout,
  goodTimeout,
  badConfig,
  goodConfig,
  weatherTool,
];

export {};
