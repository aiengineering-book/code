# 《用TypeScript全栈开发AI智能体》配套代码

本仓库是《用TypeScript全栈开发AI智能体》一书的配套代码。每个章节对应一个独立目录，可直接 clone 后按章运行。

## 分支说明

- **main 分支**：中文注释（书的主线版本，使用 OpenAI SDK）
- **en 分支**：英文注释（English readers）

## 环境要求

- Node.js >= 20
- pnpm >= 9
- OpenAI API Key
- Docker（第 4 章起，需要 PostgreSQL + pgvector）

## 快速开始

```bash
git clone https://github.com/aiengineering-book/code.git
cd code
```

### 1. 配置环境变量

每个有服务端的章节目录下都有 `.env.example`，复制并填入你的配置：

```bash
cp ch06-llm-api/server/.env.example ch06-llm-api/server/.env
# 编辑 .env，填入 OPENAI_API_KEY 等
```

常见变量：

| 变量 | 说明 | 从哪章开始需要 |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API Key | 第 1 章 |
| `DATABASE_URL` | PostgreSQL 连接串 | 第 4 章 |
| `JWT_SECRET` | JWT 签名密钥（任意字符串） | 第 4 章 |
| `PORT` | 服务端口（默认 3000） | 第 2 章 |

### 2. 启动数据库（需要 Docker）

第 4 章起的章节需要 PostgreSQL + pgvector。每个相关章节目录下都提供了 `docker-compose.yml`：

```bash
cd ch04-fullstack-basics
docker compose up -d
```

数据库默认配置：
- 地址：`localhost:5432`
- 用户名/密码：`postgres / postgres`
- 数据库名：`ts_ai_dev`

### 3. 运行章节代码

大多数章节同时包含后端（`server/`）和前端（`web/`）：

```bash
# 终端 1 — 后端
cd ch08-conversation/server
pnpm install
pnpm dev

# 终端 2 — 前端（有 web/ 目录的章节）
cd ch08-conversation/web
pnpm install
pnpm dev
```

---

## 章节目录

| 章节 | 目录 | 有无数据库 | 内容摘要 |
|---|---|---|---|
| 第 1 章 | `ch01-hello-ai/` | — | 最小 LLM 调用，单文件 |
| 第 2 章 | `ch02-dev-env/` | — | Monorepo 脚手架、TypeScript 配置 |
| 第 3 章 | — | — | 理论章节，无独立代码 |
| 第 4 章 | `ch04-fullstack-basics/` | ✅ PostgreSQL | CRUD API、Drizzle ORM、JWT 认证 |
| 第 5 章 | — | — | 理论章节，无独立代码 |
| 第 6 章 | `ch06-llm-api/` | ✅ PostgreSQL | OpenAI SDK、流式调用、成本追踪 |
| 第 7 章 | — | — | Prompt 技巧，代码片段见 ch06 |
| 第 8 章 | `ch08-conversation/` | ✅ PostgreSQL | 多轮对话、历史压缩、SSE |
| 第 9 章 | `ch09-embedding/` | ✅ pgvector | 向量嵌入、相似度搜索 |
| 第 10 章 | `ch10-ingestion/` | ✅ pgvector | 文档摄取、分块策略 |
| 第 11 章 | `ch11-rag/` | ✅ pgvector | 混合搜索（使用 `@tsaibook/bm25`）、重排序、RAG 问答 |
| 第 12 章 | `ch12-production-rag/` | ✅ pgvector | 知识库多租户、幻觉检测 |
| 第 13 章 | `ch13-agent/` | — | ReAct Agent、结构化输出 |
| 第 14 章 | `ch14-tool-calling/` | — | Function Calling、并行工具执行 |
| 第 15 章 | `ch15-browser-tools/` | — | 浏览器自动化、文件系统工具 |
| 第 16 章 | `ch16-multi-agent/` | — | 多 Agent 协作、消息总线 |
| 第 17 章 | `ch17-coding-agent/` | — | 自主编码 Agent、沙箱执行 |
| 第 18 章 | — | — | MCP 协议规范，理论章节 |
| 第 19 章 | `ch19-mcp-server/` | — | 开发第一个 MCP Server |
| 第 20 章 | `ch20-mcp-client/` | — | MCP Client 集成 |
| 第 21 章 | `ch21-mcp-publish/` | — | 可复用 MCP Server 发布 |
| 第 22 章 | `ch22-multimodal/` | — | 视觉、语音、PDF 解析 |
| 第 23 章 | `ch23-production/` | ✅ PostgreSQL | 可观测性、限流、提示注入防护 |
| 第 24 章 | `full-project/` | ✅ pgvector | 全功能集成 AI 工作台 |

---

## 公共包

| 目录 | 包名 | 说明 |
|---|---|---|
| `packages/bm25/` | `@tsaibook/bm25` | 零依赖 BM25 全文检索，第 11 章混合搜索使用 |

---

## 项目结构

每个章节目录（ch02 起）采用 monorepo 结构：

```
chXX-xxx/
├── server/          # 后端 (Hono + TypeScript)
│   ├── src/
│   ├── .env.example
│   ├── docker-compose.yml  # 需要数据库的章节才有
│   └── package.json
├── web/             # 前端 (React + Vite)，部分章节有
│   └── src/
└── shared/          # 前后端共享类型，部分章节有
    └── src/
```

`full-project/` 是第 24 章的综合项目，整合了所有能力。
