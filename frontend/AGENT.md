# Frontend Layer Context — React Client Guidance

Governs components, styling, and API standards inside `/frontend/`.

See CLAUDE.md §Coding Conventions, §API Response Contract.

---

## 1. REACT 19 & TYPESCRIPT 5+ COMPLIANCE

* **Strict Type Safety:** No `any`. Every argument, return value, state, and prop must be fully typed.
* **Component Typings:** Use named function declarations with typed props; never `React.FC`.
* **React 19 Hooks:** Prefer `useActionState` for forms, `useTransition` for async state updates, and `use` for consuming Promises/Context inline.
* **Resource Cleanup:** All `useEffect`-based custom hooks must return a cleanup function (clear timers, unsubscribe sockets).

---

## 2. TAILWIND CSS UTILITY PATTERNS & THEME DESIGN SYSTEM

* **Class Ordering:** layout/position → display → box model → typography → borders/backgrounds → effects/transitions.
* **Colors:** Prefer slate/zinc for neutrals, violet/indigo/emerald for accents. Avoid raw primary colors.
* **Glassmorphism:** `bg-white/70 backdrop-blur-md dark:bg-slate-900/70 border border-white/20` for modals and overlay cards.
* **Transitions:** Always use `transition-all duration-200 ease-in-out` on buttons and interactive elements.

---

## 3. COMPONENT FOLDER ARCHITECTURE

Files inside `frontend/src/` must align with:
- `assets/` — static images, SVGs
- `components/` — globally shared UI (buttons, inputs, modals)
- `context/` — global React context (AuthContext)
- `features/` — feature-scoped components (`tasks/`, `board/`, `analytics/`)
- `services/` — API wrappers (`supabaseClient.ts`, `apiClient.ts`)
- `types/` — shared type declarations

---

## 4. API LAYER CONTRACT & STATE MANAGEMENT

* No HTTP calls inside component bodies — all API transactions in `services/` or `features/*/api.ts`.
* Use the configured Axios instance in `apiClient.ts` with auth interceptors for all backend requests.
* Wrap main layout views with `ErrorBoundary` to capture runtime crashes gracefully.
* Use React Context + local storage for auth credentials; bind Supabase real-time triggers to client state.
