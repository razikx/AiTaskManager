import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

export interface ParsedTask {
  taskName: string;
  dueDate: string | null;
  inferredCategory: string;
  suggestedPriority: 'low' | 'medium' | 'high';
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

/**
 * Strip control characters and truncate a string to the specified max length
 * before embedding user-supplied content in an LLM prompt.
 */
function sanitizeForPrompt(input: string, maxLength: number): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // Strip control characters
    .trim()
    .slice(0, maxLength);
}

/**
 * Helper to extract a JSON object from text containing potential conversational prefix/suffix.
 */
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  return text;
}

/**
 * Helper to extract a JSON array from text containing potential conversational prefix/suffix.
 */
function extractJsonArray(text: string): string {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  return text;
}

/**
 * Parses user task sentences into structured task parameters.
 * Uses Claude Haiku via backend proxy. Falls back to regex-based rule parser if keys are missing.
 * 
 * @param rawText The raw user natural language string.
 * @returns A promise resolving to the structured ParsedTask object.
 */
export async function parseTaskText(rawText: string): Promise<ParsedTask> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('[Claude Service] ANTHROPIC_API_KEY is missing. Falling back to local rule-based regex parser.');
    return fallbackRegexParser(rawText);
  }

  const referenceDate = new Date().toISOString();

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: [
        {
          type: 'text',
          text: `You are an expert Natural Language Processing (NLP) task parser. Your job is to extract task parameters from user text.
Analyze the user's task description and return a single raw JSON object matching this interface:
{
  "taskName": string, // Short title representing the core action (e.g. "Call dentist")
  "dueDate": string | null, // ISO-8601 string calculated relative to the reference time provided in the user message (e.g. next Tuesday at 3pm). If no time is specified, default to 12:00 PM. If no date is specified, return null.
  "inferredCategory": string, // A logical one-word category (e.g., Work, Personal, Shopping, Health, Finance, Social)
  "suggestedPriority": "low" | "medium" | "high" // Deduced urgency based on semantics, deadlines, and urgency cues
}
Do not wrap your output in markdown JSON blocks (\`\`\`json). Return raw JSON text only.`,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [
        {
          role: 'user',
          content: `Reference time: ${referenceDate}\nParse this task: "${sanitizeForPrompt(rawText, 2000)}"`
        }
      ]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Clean up any accidental markdown tags if the model added them despite instructions
    const cleanText = responseText.replace(/```json|```/g, '').trim();
    const jsonString = extractJsonObject(cleanText);

    const parsed: ParsedTask = JSON.parse(jsonString);

    // Validate properties are present and correctly typed
    return {
      taskName: parsed.taskName || rawText,
      dueDate: parsed.dueDate || null,
      inferredCategory: parsed.inferredCategory || 'Personal',
      suggestedPriority: ['low', 'medium', 'high'].includes(parsed.suggestedPriority)
        ? parsed.suggestedPriority
        : 'medium'
    };
  } catch (err) {
    console.error('[Claude Service] Error parsing task text via Claude API:', err);
    console.log('[Claude Service] Falling back to regex-based rule parser.');
    return fallbackRegexParser(rawText);
  }
}

/**
 * A regex rule-based parser that executes offline when Claude API is not configured or fails.
 */
function fallbackRegexParser(rawText: string): ParsedTask {
  const lowercaseText = rawText.toLowerCase();

  // 1. Urgency heuristics
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if (
    lowercaseText.includes('urgent') ||
    lowercaseText.includes('asap') ||
    lowercaseText.includes('immediately') ||
    lowercaseText.includes('critical')
  ) {
    priority = 'high';
  } else if (
    lowercaseText.includes('low priority') ||
    lowercaseText.includes('whenever') ||
    lowercaseText.includes('some day')
  ) {
    priority = 'low';
  }

  // 2. Category heuristics
  let category = 'Personal';
  if (
    lowercaseText.includes('buy') ||
    lowercaseText.includes('shop') ||
    lowercaseText.includes('groceries')
  ) {
    category = 'Shopping';
  } else if (
    lowercaseText.includes('call') ||
    lowercaseText.includes('email') ||
    lowercaseText.includes('meeting') ||
    lowercaseText.includes('submit') ||
    lowercaseText.includes('work') ||
    lowercaseText.includes('project')
  ) {
    category = 'Work';
  } else if (
    lowercaseText.includes('dentist') ||
    lowercaseText.includes('doctor') ||
    lowercaseText.includes('exercise') ||
    lowercaseText.includes('gym') ||
    lowercaseText.includes('health')
  ) {
    category = 'Health';
  } else if (
    lowercaseText.includes('pay') ||
    lowercaseText.includes('bill') ||
    lowercaseText.includes('rent') ||
    lowercaseText.includes('credit')
  ) {
    category = 'Finance';
  }

  // 3. Simple text title cleanup
  let taskName = rawText.trim();
  // Capitalize first character
  if (taskName.length > 0) {
    taskName = taskName.charAt(0).toUpperCase() + taskName.slice(1);
  }

  return {
    taskName,
    dueDate: null, // Hard to parse dates reliably via regex
    inferredCategory: category,
    suggestedPriority: priority
  };
}

/**
 * Generates an array of subtask strings to break down a complex task.
 * Uses Claude Haiku API if credentials exist, otherwise falls back to keyword-based heuristics.
 */
export async function generateSubtasksForTask(taskTitle: string, taskDescription?: string): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const descriptionText = taskDescription ? ` (Description: ${taskDescription})` : '';
  const combinedText = `Task: "${taskTitle}"${descriptionText}`;

  if (!apiKey) {
    console.warn('[Claude Service] ANTHROPIC_API_KEY is missing. Falling back to local checklist heuristics.');
    return fallbackSubtasksGenerator(taskTitle, taskDescription || '');
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: [
        {
          type: 'text',
          text: `You are an expert project manager. Break down the user's task into a raw JSON array of 3 to 5 logical, sequential, and action-oriented subtask items (strings).
Each subtask item should be a short, direct action (e.g. "Draft research outline", "Send draft for review", "Address edits").
Output a valid JSON array of strings only. Do not include markdown indicators like \`\`\`json or introductory/concluding commentary.`,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [
        {
          role: 'user',
          content: `Break down this task: ${sanitizeForPrompt(combinedText, 500)}`
        }
      ]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const cleanText = responseText.replace(/```json|```/g, '').trim();
    const jsonString = extractJsonArray(cleanText);
    const parsed = JSON.parse(jsonString);

    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed.slice(0, 6); // Limit to max 6 subtasks
    }
    
    console.warn('[Claude Service] Response from AI was not an array of strings:', cleanText);
    return fallbackSubtasksGenerator(taskTitle, taskDescription || '');
  } catch (err) {
    console.error('[Claude Service] Error generating subtasks via Claude API:', err);
    return fallbackSubtasksGenerator(taskTitle, taskDescription || '');
  }
}

/**
 * Keyword-based heuristic subtask generator that runs offline when Claude API is not configured or fails.
 */
function fallbackSubtasksGenerator(title: string, description: string): string[] {
  const combinedText = `${title} ${description}`.toLowerCase();

  // 1. Work / Meeting / Call
  if (
    combinedText.includes('meeting') ||
    combinedText.includes('call') ||
    combinedText.includes('discuss') ||
    combinedText.includes('zoom') ||
    combinedText.includes('interview')
  ) {
    return [
      'Prepare agenda and key talking points',
      'Attend the meeting and take notes',
      'Identify action items and next steps',
      'Send a brief follow-up summary to participants'
    ];
  }

  // 2. Coding / Development / Software / Bug
  if (
    combinedText.includes('code') ||
    combinedText.includes('program') ||
    combinedText.includes('bug') ||
    combinedText.includes('fix') ||
    combinedText.includes('develop') ||
    combinedText.includes('implement') ||
    combinedText.includes('api') ||
    combinedText.includes('database') ||
    combinedText.includes('git')
  ) {
    return [
      'Define core requirements and research solution',
      'Create or update unit tests for expected behavior',
      'Implement code changes and fix lint errors',
      'Manually verify the implementation and commit changes'
    ];
  }

  // 3. Purchase / Shopping / Buy
  if (
    combinedText.includes('buy') ||
    combinedText.includes('shop') ||
    combinedText.includes('purchase') ||
    combinedText.includes('groceries') ||
    combinedText.includes('order')
  ) {
    return [
      'Create list of required items',
      'Check store locations, availability, or pricing',
      'Purchase the items and secure receipts',
      'Unpack, organize, or store items'
    ];
  }

  // 4. Study / Learning / Research
  if (
    combinedText.includes('study') ||
    combinedText.includes('learn') ||
    combinedText.includes('read') ||
    combinedText.includes('exam') ||
    combinedText.includes('research') ||
    combinedText.includes('course')
  ) {
    return [
      'Identify key topics or materials to review',
      'Read through notes, docs, or textbooks',
      'Write down summary notes or create flashcards',
      'Take a self-assessment or practice quiz'
    ];
  }

  // 5. Cleaning / House chores
  if (
    combinedText.includes('clean') ||
    combinedText.includes('wash') ||
    combinedText.includes('laundry') ||
    combinedText.includes('organize') ||
    combinedText.includes('dishes') ||
    combinedText.includes('tidy')
  ) {
    return [
      'Gather necessary cleaning supplies and tools',
      'Declutter the space and put items away',
      'Wipe down, scrub, or clean all main surfaces',
      'Sweep, vacuum, or mop floors and empty trash'
    ];
  }

  // 6. Travel / Booking
  if (
    combinedText.includes('travel') ||
    combinedText.includes('trip') ||
    combinedText.includes('flight') ||
    combinedText.includes('hotel') ||
    combinedText.includes('book') ||
    combinedText.includes('ticket')
  ) {
    return [
      'Compare travel options, schedules, and costs',
      'Make bookings for transportation and lodging',
      'Confirm reservations and download tickets/passes',
      'Create a packing list and pack bags'
    ];
  }

  // 7. General Fallback
  return [
    'Research requirements and plan the approach',
    'Execute the core steps of the task',
    'Review the outcome and make refinements',
    'Finalize the details and mark as completed'
  ];
}
