/**
 * Game Configuration
 *
 * Defines the interface for agents to interact with the game.
 * This is extracted at runtime and passed to benchmark runners.
 */

import { z } from 'zod';

// ============================================================================
// Schema Definitions
// ============================================================================

export const GameToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.object({
    type: z.string(),
    description: z.string(),
    required: z.boolean().optional(),
  })),
  returns: z.record(z.object({
    type: z.string(),
    description: z.string(),
  })),
});

export const GameConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  rules: z.string(),
  goal: z.string(),
  scoring: z.string(),
  tools: z.array(GameToolSchema),
  metrics: z.object({
    primary: z.string(),
    secondary: z.array(z.string()),
  }),
});

export type GameTool = z.infer<typeof GameToolSchema>;
export type GameConfig = z.infer<typeof GameConfigSchema>;

// ============================================================================
// Pangram Game Configuration
// ============================================================================

export const PANGRAM_CONFIG: GameConfig = {
  id: 'pangram',
  name: 'Pangram',
  version: '1.0.0',
  description: 'A word puzzle game where you find words using 7 letters, always including the center letter.',

  rules: `
- You have 7 letters available, one is the CENTER letter
- Every word MUST include the center letter
- Words must be at least 4 letters long
- Letters can be reused within a word
- Pangrams (words using ALL 7 letters) score bonus points
- Words must be valid English dictionary words
`.trim(),

  goal: 'Maximize your score by finding as many valid words as possible, especially pangrams.',

  scoring: `
- 4-letter words: 1 point
- 5+ letter words: 1 point per letter
- Pangrams (all 7 letters): word length + 7 bonus points
`.trim(),

  tools: [
    {
      name: 'observe',
      description: 'Get the current game state including available letters, center letter, current score, and words already found.',
      parameters: {},
      returns: {
        letters: { type: 'string[]', description: 'The 7 available letters' },
        centerLetter: { type: 'string', description: 'The required center letter' },
        score: { type: 'number', description: 'Current score' },
        foundWords: { type: 'string[]', description: 'Words already found' },
        lastMessage: { type: 'string', description: 'Feedback from last action' },
      },
    },
    {
      name: 'submit_word',
      description: 'Submit a word to score points. The word must be 4+ letters, use only the available letters, and include the center letter.',
      parameters: {
        word: { type: 'string', description: 'The word to submit', required: true },
      },
      returns: {
        accepted: { type: 'boolean', description: 'Whether the word was accepted' },
        pointsEarned: { type: 'number', description: 'Points earned (0 if rejected)' },
        message: { type: 'string', description: 'Feedback message' },
        newScore: { type: 'number', description: 'Updated total score' },
      },
    },
  ],

  metrics: {
    primary: 'score',
    secondary: ['wordsFound', 'pangrams', 'efficiency'],
  },
};

// ============================================================================
// Config Export Function
// ============================================================================

/**
 * Get the game configuration for agents
 */
export function getGameConfig(): GameConfig {
  return PANGRAM_CONFIG;
}

/**
 * Generate a system prompt from the game config
 */
export function generateSystemPrompt(config: GameConfig): string {
  const toolDocs = config.tools.map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `  - ${k}: ${v.type} - ${v.description}`)
      .join('\n');
    const returns = Object.entries(t.returns)
      .map(([k, v]) => `  - ${k}: ${v.type} - ${v.description}`)
      .join('\n');
    return `### ${t.name}\n${t.description}\n${params ? `Parameters:\n${params}` : 'No parameters'}\nReturns:\n${returns}`;
  }).join('\n\n');

  return `# ${config.name}

${config.description}

## Rules
${config.rules}

## Goal
${config.goal}

## Scoring
${config.scoring}

## Available Tools
${toolDocs}

## Strategy Tips
- Pangrams (words using ALL 7 letters) score the most points
- You have access to a Node.js sandbox with internet access - you can fetch dictionaries, run algorithms, etc.
- Maximize your score efficiently
`;
}
