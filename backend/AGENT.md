# Backend Layer Context — Express Server Guidance

Governs routing, security, database adapters, and LLM integrations inside `/backend/`.

See CLAUDE.md §Architecture, §API Response Contract, §Coding Conventions.

---

## 1. ROUTER ORGANIZATION, CONTROLLER PATTERNS & REST STANDARDS

MVC/service separation — `config/`, `controllers/`, `middleware/`, `routes/`, `services/`, `types/`, `index.ts`.

* URIs use plural nouns: `/api/tasks`, `/api/projects`.
* Task filtering by project uses a query param: `/api/tasks?projectId=...` (not a sub-resource path).
* Controller verb mapping: `GET` → `getTasks`, `POST` → `createTask`, `PATCH` → `updateTask`, `DELETE` → `deleteTask`.

---

## 2. STATELESS JWT AUTHENTICATION & GUARD RULES

See CLAUDE.md §Architecture for JWT verification strategy.

* All protected routes expect `Bearer <token>`; return 401 on missing auth, 401 on invalid/expired.
* Decoded `{ id, email }` attached to `AuthenticatedRequest` and forwarded via `next()`.

---

## 3. SUPABASE CLIENT CONFIGURATION & POSTGRES PROTOCOLS

* Two client instances: user-scoped (derived from request JWT — use this for all request-bound CRUD) and admin (`service_role`, bypasses RLS — reserve for background jobs, migrations, and admin actions outside a user request context).
* Current state: controllers call Supabase directly. Target pattern: isolate DB logic inside `services/`; controllers orchestrate only. Move toward this when adding new controllers or doing significant refactors.

---

## 4. GLOBAL CENTRALIZED ERROR HANDLING

* Controllers return `res.status(4xx).json(...)` directly for expected domain errors (validation failures, DB constraint errors, not found). Use `next(err)` only for unexpected runtime errors.
* Central handler reads `err.status` (default 500) and `err.code` (default `INTERNAL_SERVER_ERROR`).
* Returns sanitized `ApiResponse`; includes `err.details` in `development` only.

---

## 5. CLAUDE HAIKU API INTEGRATION RULES

* All Claude interactions in single prompt utility functions inside `/services/claudeService.ts`.
* Instruct Claude to return raw JSON only — no markdown markers. Parse with `JSON.parse` inside try-catch.
* Return standard fallback values if `JSON.parse` fails (never crash the route).
* System prompt must specify exact JSON shape: `taskName`, `dueDate` (ISO or null), `inferredCategory`, `suggestedPriority` (`low|medium|high`).
