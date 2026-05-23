# CLAUDE.md — Project Memory & Developer Guidelines

## Project
AI-Powered Task Manager — NLP task parsing, subtask generation, smart prioritization, real-time sync.

---

## Stack
- **Frontend:** React 19 + TypeScript 5, Tailwind CSS → Vercel
- **Backend:** Node.js + Express (JWT proxy) → Railway
- **DB/Auth:** Supabase (PostgreSQL, RLS, real-time)
- **AI:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) via Express proxy — never called directly from client

---

## Gaps & Outstanding Work
See `GAPS.md` (gitignored, project root) — prioritized list of security fixes, missing features, and resolved issues. Check it at the start of every session.

---

## Status
- **Phase:** Deployed (MVP live) + CI/CD active
- **Frontend (Vercel):** https://razikx.com — GHA auto-deploys on `frontend/**` push; manual: `vercel --prod` from `/frontend`
- **Backend (Railway):** https://ai-task-manager-backend-production-e73a.up.railway.app — auto-deploys via Railway GitHub integration on push to `main`
- **Key env note:** `VITE_API_URL` must include `/api` suffix; `CORS_ORIGIN` on Railway is comma-separated (`https://razikx.com,https://www.razikx.com,https://frontend-kappa-sand-ihllnsfmku.vercel.app`)

---

## Architecture (Immutable)
- React never imports Anthropic SDK — all Claude calls route through Express only
- Client uses Supabase SDK for auth/realtime; Express uses service-role token for DB writes
- JWTs from Supabase Auth verified statelessly in Express middleware (`authGuard.ts`)
- All LLM prompts defined server-side; client sends raw user text only

---

## API Response Contract (Immutable)
All Express routes must return:
```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown; };
}
```

---

## Coding Conventions (Immutable)
- `kebab-case` for utils/routes/middleware; `PascalCase` for React components
- Semicolons always; 2-space indent; no tabs
- No `any` — use `unknown` + type narrowing; avoid `as Type` unless required by external lib

---

## Response Style (Immutable)
- No conversational intros, conclusions, or summaries unless explicitly asked
- Never regenerate full files — output only the modified snippet
- Silent background mutations — one-line acknowledgment only
