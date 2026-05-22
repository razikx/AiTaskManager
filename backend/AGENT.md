# Backend Layer Context — Express Server Guidance

Governs routing, security, database adapters, and LLM integrations inside `/backend/`.

See CLAUDE.md §Architecture, §API Response Contract, §Coding Conventions.

---

## 1. ROUTER ORGANIZATION, CONTROLLER PATTERNS & REST STANDARDS

MVC/service separation — `config/`, `controllers/`, `middleware/`, `routes/`, `services/`, `types/`, `index.ts`.

* URIs use plural nouns: `/api/tasks`, `/api/projects`.
* Sub-resource paths: `/api/projects/:projectId/tasks`.
* Controller verb mapping: `GET` → `getTasks`, `POST` → `createTask`, `PATCH` → `updateTask`, `DELETE` → `deleteTask`.

---

## 2. STATELESS JWT AUTHENTICATION & GUARD RULES

See CLAUDE.md §Architecture for JWT verification strategy.

* All protected routes expect `Bearer <token>`; return 401 on missing auth, 412 on invalid/expired.
* Decoded `{ id, email }` attached to `AuthenticatedRequest` and forwarded via `next()`.

---

## 3. SUPABASE CLIENT CONFIGURATION & POSTGRES PROTOCOLS

* Two client instances: standard (derived from request token, user privilege) and admin (`service_role`, bypasses RLS for system actions).
* Isolate DB transactions inside `services/`; never in controllers.

---

## 4. GLOBAL CENTRALIZED ERROR HANDLING

* Controllers pass errors via `next(error)`; never send error responses directly.
* Central handler reads `err.status` (default 500) and `err.code` (default `INTERNAL_SERVER_ERROR`).
* Returns sanitized `ApiResponse`; includes `err.details` in `development` only.

---

## 5. CLAUDE HAIKU API INTEGRATION RULES

* All Claude interactions in single prompt utility functions inside `/services/claudeService.ts`.
* Instruct Claude to return raw JSON only — no markdown markers. Parse with `JSON.parse` inside try-catch.
* Return standard fallback values if `JSON.parse` fails (never crash the route).
* System prompt must specify exact JSON shape: `taskName`, `dueDate` (ISO or null), `inferredCategory`, `suggestedPriority` (`low|medium|high`).
* For streaming analytics, set `stream: true` and pipe segments with `text/event-stream` mime-type.
