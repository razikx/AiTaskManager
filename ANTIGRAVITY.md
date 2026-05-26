# ANTIGRAVITY.md — Antigravity 2.0 Workspace Context

Standalone context for Antigravity 2.0 subagent sessions on the AiTaskManager workspace.

---

## Project

See CLAUDE.md §Project.

---

## Stack

See CLAUDE.md §Stack.

---

## Gaps & Outstanding Work

See `GAPS.md` (gitignored, project root) — prioritized list of security fixes, missing features, and resolved issues. Check it at the start of every session.

---

## Status
- **Phase:** Deployed (MVP live) + CI/CD active
- **Frontend (Vercel):** https://razikx.com — GHA auto-deploys on `frontend/**` push; manual: `vercel --prod` from `/frontend`
- **Backend (Railway):** https://ai-task-manager-backend-production-e73a.up.railway.app — auto-deploys via Railway GitHub integration on push to `main`
- **Key env note:** `VITE_API_URL` must include `/api` suffix; `CORS_ORIGIN` on Railway is comma-separated (`https://razikx.com,https://www.razikx.com,https://frontend-kappa-sand-ihllnsfmku.vercel.app`)
- **Deploy order:** Run Supabase SQL migration first → push backend → push frontend. Never push backend code that depends on a schema change before the migration runs.

---

## Architecture (Immutable)

See CLAUDE.md §Architecture.

---

## API Response Contract (Immutable)

See CLAUDE.md §API Response Contract.

---

## Testing

See CLAUDE.md §Testing.

---

## Coding Conventions (Immutable)

See CLAUDE.md §Coding Conventions.

---

## Response Style (Immutable)

See CLAUDE.md §Response Style.
