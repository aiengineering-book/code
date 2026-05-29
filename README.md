# Full-Stack AI Agents with TypeScript — Companion Code

This repository contains the companion code for *Full-Stack AI Agents with TypeScript*. Each chapter has its own directory and can be run independently after cloning.

## Branch Notes

- **main branch**: Chinese comments (primary version, uses OpenAI SDK)
- **en branch**: English comments (you are here)

## Requirements

- Node.js >= 20
- pnpm >= 9
- OpenAI API Key
- Docker (from Chapter 4 onward — required for PostgreSQL + pgvector)

## Getting Started

```bash
git clone https://github.com/aiengineering-book/code.git
cd code
```

### 1. Set up environment variables

Each chapter's `server/` directory includes a `.env.example`. Copy and fill it in:

```bash
cp ch06-llm-api/server/.env.example ch06-llm-api/server/.env
# Edit .env and add your OPENAI_API_KEY etc.
```

Common variables:

| Variable | Description | Required from |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key | Chapter 1 |
| `DATABASE_URL` | PostgreSQL connection string | Chapter 4 |
| `JWT_SECRET` | JWT signing secret (any string) | Chapter 4 |
| `PORT` | Server port (default: 3000) | Chapter 2 |

### 2. Start the database (Docker required)

Chapters 4 onward need PostgreSQL + pgvector. Each relevant chapter directory includes a `docker-compose.yml`:

```bash
cd ch04-fullstack-basics
docker compose up -d
```

Default database config:
- Host: `localhost:5432`
- Username / Password: `postgres / postgres`
- Database name: `ts_ai_dev`

### 3. Run a chapter

Most chapters have both a backend (`server/`) and a frontend (`web/`):

```bash
# Terminal 1 — backend
cd ch08-conversation/server
pnpm install
pnpm dev

# Terminal 2 — frontend (chapters with a web/ directory)
cd ch08-conversation/web
pnpm install
pnpm dev
```

---

## Chapter Index

| Chapter | Directory | Database | Summary |
|---|---|---|---|
| Ch 1  | `ch01-hello-ai/` | — | Minimal LLM call, single file |
| Ch 2  | `ch02-dev-env/` | — | Monorepo scaffold, TypeScript config |
| Ch 3  | — | — | Theory chapter, no standalone code |
| Ch 4  | `ch04-fullstack-basics/` | ✅ PostgreSQL | CRUD API, Drizzle ORM, JWT auth |
| Ch 5  | — | — | Theory chapter, no standalone code |
| Ch 6  | `ch06-llm-api/` | ✅ PostgreSQL | OpenAI SDK, streaming, cost tracking |
| Ch 7  | — | — | Prompt techniques; code samples in ch06 |
| Ch 8  | `ch08-conversation/` | ✅ PostgreSQL | Multi-turn conversation, context compression, SSE |
| Ch 9  | `ch09-embedding/` | ✅ pgvector | Vector embeddings, similarity search |
| Ch 10 | `ch10-ingestion/` | ✅ pgvector | Document ingestion, chunking strategies |
| Ch 11 | `ch11-rag/` | ✅ pgvector | Hybrid search (using `@tsaibook/bm25`), reranking, RAG Q&A |
| Ch 12 | `ch12-production-rag/` | ✅ pgvector | Multi-tenant knowledge base, hallucination detection |
| Ch 13 | `ch13-agent/` | — | ReAct Agent, structured output |
| Ch 14 | `ch14-tool-calling/` | — | Function Calling, parallel tool execution |
| Ch 15 | `ch15-browser-tools/` | — | Browser automation, filesystem tools |
| Ch 16 | `ch16-multi-agent/` | — | Multi-agent collaboration, message bus |
| Ch 17 | `ch17-coding-agent/` | — | Autonomous coding agent, sandboxed execution |
| Ch 18 | — | — | MCP protocol spec, theory chapter |
| Ch 19 | `ch19-mcp-server/` | — | Building your first MCP Server |
| Ch 20 | `ch20-mcp-client/` | — | MCP Client integration |
| Ch 21 | `ch21-mcp-publish/` | — | Publishing a reusable MCP Server |
| Ch 22 | `ch22-multimodal/` | — | Vision, speech, PDF parsing |
| Ch 23 | `ch23-production/` | ✅ PostgreSQL | Observability, rate limiting, prompt injection defense |
| Ch 24 | `full-project/` | ✅ pgvector | Full-featured integrated AI workbench |

---

## Shared Packages

| Directory | Package | Description |
|---|---|---|
| `packages/bm25/` | `@tsaibook/bm25` | Zero-dependency BM25 full-text search for Node.js / TypeScript |

---

## Repository Structure

Each chapter directory (ch02 onward) follows a monorepo layout:

```
chXX-xxx/
├── server/          # Backend (Hono + TypeScript)
│   ├── src/
│   ├── .env.example
│   ├── docker-compose.yml  # present only in chapters that need a database
│   └── package.json
├── web/             # Frontend (React + Vite) — present in most chapters
│   └── src/
└── shared/          # Shared types — present in some chapters
    └── src/
```

`full-project/` is the Chapter 24 capstone that integrates all capabilities.
