-- Migration: Add category column to tasks and backfill from description
-- Run this in the Supabase SQL editor before deploying the matching backend/frontend changes.

-- 1. Add column
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Backfill rows where description is exclusively the AI-inferred category pattern.
--    Extracts the category word, stores it, and clears description (it held no real user notes).
UPDATE public.tasks
SET
  category    = (regexp_match(description, 'Inferred Category:\s*(\w+)'))[1],
  description = NULL
WHERE description ~ '^Inferred Category:\s*\w+$';
