# Writing XState Machines

The state machine is the **single source of truth** for game state. Both humans (via UI) and agents interact through the same machine events.

## XState v5 Basics

```typescript
import { setup, assign, fromPromise } from 'xstate';

export const gameMachine = setup({
  types: { /* TypeScript types */ },
  actions: { /* reusable actions */ },
  guards: { /* conditional logic */ },
  actors: { /* async operations */ },
}).createMachine({
  id: 'game',
  initial: 'playing',
  context: { /* initial state */ },
  states: { /* state definitions */ },
});
```

## File Structure

```typescript
// src/machine.ts

import { setup, assign, fromPromise } from 'xstate';
import { validateWordRules, calculateWordScore } from './mechanics.js';

// ============================================================================
// Types
// ============================================================================

export interface GameContext {
  score: number;
  // ... all game state
}

export type GameEvent =
  | { type: 'MAKE_MOVE'; data: MoveData }
  | { type: 'RESET' };

// ============================================================================
// Machine Setup
// ============================================================================

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    input: {} as { puzzleIndex?: number },
  },
  actions: { /* ... */ },
  guards: { /* ... */ },
  actors: { /* ... */ },
}).createMachine({
  id: 'game',
  initial: 'playing',
  context: ({ input }) => ({ /* initial context from input */ }),
  states: { /* ... */ },
});
```

## Context Design

Context holds all game state. Keep it minimal and flat:

```typescript
export interface PangramContext {
  // Puzzle configuration
  letters: string[];
  centerLetter: string;
  puzzleIndex: number;

  // Player state
  currentInput: string;
  foundWords: string[];
  score: number;

  // UI feedback
  lastMessage: string;
  lastMessageType: 'info' | 'success' | 'error' | 'pangram';
}
```

**Guidelines:**
- Store raw data, not computed values
- Avoid nested objects when possible
- Include feedback fields for UI messages

## Event Design

### Human Events (Granular)

For keyboard/mouse input:

```typescript
| { type: 'ADD_LETTER'; letter: string }
| { type: 'DELETE_LETTER' }
| { type: 'CLEAR' }
| { type: 'SUBMIT' }
```

### Agent Events (Consolidated)

Single event for complete actions:

```typescript
| { type: 'SUBMIT_WORD'; word: string }  // Combines ADD_LETTER + SUBMIT
```

This follows the **tool consolidation principle** - agents shouldn't need to send 10 events when 1 will do.

## Permissive Machine Design

**Key principle:** Accept any input, provide feedback. Don't block invalid actions.

```typescript
// ❌ Bad: Guards that block
SUBMIT: {
  guard: ({ context }) => context.currentInput.length >= 4,
  target: 'validating',
}

// ✅ Good: Accept and provide feedback
SUBMIT: [
  {
    guard: ({ context }) => context.currentInput.length >= 4,
    target: 'validating',
  },
  {
    // No guard = fallback
    actions: assign({
      lastMessage: 'Word must be at least 4 letters',
      lastMessageType: 'error' as const,
    }),
  },
],
```

Why permissive?
- Agents learn from feedback, not from blocked events
- UI can show error messages instead of disabled buttons
- Simpler testing - all events are accepted

## Actions

Use `assign` for state updates:

```typescript
actions: {
  addLetter: assign(({ context, event }) => {
    if (event.type !== 'ADD_LETTER') return {};
    const letter = event.letter.toUpperCase();

    // Silently ignore invalid letters (permissive)
    if (!context.letters.includes(letter)) return {};

    return {
      currentInput: context.currentInput + letter,
      lastMessage: '',
    };
  }),

  deleteLetter: assign(({ context }) => {
    if (context.currentInput.length === 0) return {}; // No-op if empty
    return {
      currentInput: context.currentInput.slice(0, -1),
    };
  }),

  recordValidWord: assign(({ context }, params: { word: string; points: number }) => ({
    foundWords: [...context.foundWords, params.word].sort(),
    score: context.score + params.points,
    currentInput: '',
    lastMessage: `+${params.points} points!`,
    lastMessageType: 'success' as const,
  })),
}
```

## Async Operations with Actors

Use `fromPromise` for async validation:

```typescript
actors: {
  validateWord: fromPromise(async ({ input }: {
    input: { word: string; letters: string[]; centerLetter: string; foundWords: string[] }
  }) => {
    const { word, letters, centerLetter, foundWords } = input;

    // 1. Check game rules (sync)
    const rulesResult = validateWordRules(word, letters, centerLetter, foundWords);
    if (!rulesResult.valid) {
      return { valid: false, reason: rulesResult.reason };
    }

    // 2. Check dictionary (async)
    const isValidWord = await validateWordDictionary(word);
    if (!isValidWord) {
      return { valid: false, reason: 'Not a valid English word' };
    }

    // 3. Calculate score
    const points = calculateWordScore(word.toLowerCase(), letters);
    return { valid: true, word: word.toLowerCase(), points };
  }),
}
```

## State Transitions

```typescript
states: {
  playing: {
    on: {
      ADD_LETTER: { actions: 'addLetter' },
      DELETE_LETTER: { actions: 'deleteLetter' },
      CLEAR: { actions: 'clearInput' },

      SUBMIT: [
        {
          guard: ({ context }) => context.currentInput.length >= 4,
          target: 'validating',
        },
        {
          actions: assign({
            lastMessage: 'Word must be at least 4 letters',
            lastMessageType: 'error' as const,
          }),
        },
      ],

      // Consolidated event for agents
      SUBMIT_WORD: [
        {
          guard: ({ context, event }) => {
            if (event.type !== 'SUBMIT_WORD') return false;
            const validLetters = event.word
              .toUpperCase()
              .split('')
              .filter(l => context.letters.includes(l));
            return validLetters.length >= 4;
          },
          actions: 'setWord',
          target: 'validating',
        },
        {
          actions: assign({
            lastMessage: 'Word must be at least 4 valid letters',
            lastMessageType: 'error' as const,
          }),
        },
      ],
    },
  },

  validating: {
    invoke: {
      src: 'validateWord',
      input: ({ context }) => ({
        word: context.currentInput,
        letters: context.letters,
        centerLetter: context.centerLetter,
        foundWords: context.foundWords,
      }),
      onDone: [
        {
          guard: ({ event }) => event.output.valid === true,
          target: 'playing',
          actions: assign(({ context, event }) => ({
            foundWords: [...context.foundWords, event.output.word].sort(),
            score: context.score + event.output.points,
            currentInput: '',
            lastMessage: `+${event.output.points} points!`,
            lastMessageType: 'success' as const,
          })),
        },
        {
          target: 'playing',
          actions: assign(({ event }) => ({
            currentInput: '',
            lastMessage: event.output.reason,
            lastMessageType: 'error' as const,
          })),
        },
      ],
      onError: {
        target: 'playing',
        actions: assign({
          lastMessage: 'Failed to validate word',
          lastMessageType: 'error' as const,
        }),
      },
    },
  },
}
```

## Testing Machines

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createActor } from 'xstate';
import { gameMachine } from './machine.js';

// Mock async operations
vi.mock('./mechanics.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    validateWordDictionary: vi.fn().mockResolvedValue(true),
  };
});

describe('Game Machine', () => {
  it('starts in playing state', () => {
    const actor = createActor(gameMachine, { input: { puzzleIndex: 0 } });
    actor.start();
    expect(actor.getSnapshot().value).toBe('playing');
    actor.stop();
  });

  it('accepts valid words', async () => {
    const actor = createActor(gameMachine, { input: { puzzleIndex: 0 } });
    actor.start();

    actor.send({ type: 'SUBMIT_WORD', word: 'RACK' });
    await new Promise(r => setTimeout(r, 100)); // Wait for async

    expect(actor.getSnapshot().context.foundWords).toContain('rack');
    actor.stop();
  });

  it('provides error feedback for short words', () => {
    const actor = createActor(gameMachine, { input: { puzzleIndex: 0 } });
    actor.start();

    actor.send({ type: 'SUBMIT_WORD', word: 'RK' });

    const ctx = actor.getSnapshot().context;
    expect(ctx.lastMessage).toContain('4');
    expect(ctx.lastMessageType).toBe('error');
    actor.stop();
  });
});
```

## Guidelines

1. **Single source of truth** - All state lives in context
2. **Permissive design** - Accept input, provide feedback
3. **Consolidated events** - Offer single-event versions for agents
4. **Use actors for async** - Keep actions synchronous
5. **Feedback in context** - Store messages for UI display
6. **Export types** - Context and Event types for consumers

## Reference

See [`games/pangram/src/machine.ts`](../games/pangram/src/machine.ts) for a complete example.
