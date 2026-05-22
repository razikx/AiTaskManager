# AI-Powered Task Manager — Frontend Client

This directory houses the frontend React client for the AI-Powered Task Manager (`AiTaskManager`).

## Tech Stack
* **React 19**
* **TypeScript 5**
* **Vite**
* **Tailwind CSS**
* **Supabase Client SDK**

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in this directory with the following variables:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3000
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

## Folder Structure
* `src/assets/`: Static graphics/images.
* `src/components/`: Reusable global UI elements.
* `src/context/`: Context declarations (e.g., Authentication).
* `src/features/`: Feature-specific modules (tasks, board, analytics).
* `src/services/`: Client wrappers and external APIs.
* `src/types/`: TypeScript definitions.
