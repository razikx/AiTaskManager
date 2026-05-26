import { afterEach, describe, expect, it } from 'vitest';
import { generateSubtasksForTask, parseTaskText } from './claudeService.js';

const originalApiKey = process.env.ANTHROPIC_API_KEY;

describe('claudeService fallback behavior', () => {
  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it('uses the regex parser when Anthropic credentials are missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const parsed = await parseTaskText('urgent buy groceries');

    expect(parsed).toEqual({
      taskName: 'Urgent buy groceries',
      dueDate: null,
      inferredCategory: 'Shopping',
      suggestedPriority: 'high',
      priority_score: 3
    });
  });

  it('uses checklist heuristics when Anthropic credentials are missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const subtasks = await generateSubtasksForTask('fix API bug');

    expect(subtasks).toContain('Create or update unit tests for expected behavior');
    expect(subtasks).toContain('Implement code changes and fix lint errors');
  });
});
