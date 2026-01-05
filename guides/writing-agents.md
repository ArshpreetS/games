# Writing Agents

Agents play games through the **same interface as humans** - by sending events and observing state. They do NOT call mechanics functions directly.

## Core Principle

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   Agent                          Machine            │
│   ┌─────┐    send(event)    ┌───────────────┐      │
│   │     │ ─────────────────▶│               │      │
│   │     │                   │  State        │      │
│   │     │ ◀───────────────  │  Machine      │      │
│   └─────┘    observe()      │               │      │
│                             └───────────────┘      │
│                                                     │
│   ✅ Send events (SUBMIT_WORD)                      │
│   ✅ Observe context (score, foundWords)            │
│   ❌ Call mechanics directly                        │
│   ❌ Access internal machine state                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## File Structure

```typescript
// src/agent.ts

import { createActor } from 'xstate';
import { gameMachine } from './machine.js';

// Observation helper
function observe(actor) { /* ... */ }

// Wait for async operations
async function waitForResult(actor) { /* ... */ }

// Main agent loop
async function playGame() { /* ... */ }

// Exports and entry point
export { playGame, observe };
playGame();
```

## The Observe Function

Extract observable state from machine snapshot:

```typescript
function observe(actor: ReturnType<typeof createActor<typeof gameMachine>>) {
  const snapshot = actor.getSnapshot();
  const ctx = snapshot.context;

  return {
    // Game state
    letters: ctx.letters,
    centerLetter: ctx.centerLetter,
    score: ctx.score,
    foundWords: ctx.foundWords,

    // Feedback
    lastMessage: ctx.lastMessage,
    lastMessageType: ctx.lastMessageType,

    // Machine state
    isValidating: snapshot.value === 'validating',
  };
}
```

**Only observe what's in context** - this is what a human player would see.

## Waiting for Async Results

Machine transitions to `validating` state during async operations:

```typescript
async function waitForResult(
  actor: ReturnType<typeof createActor<typeof gameMachine>>,
  maxWait = 5000
) {
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const obs = observe(actor);
    if (!obs.isValidating) return obs;
    await new Promise(r => setTimeout(r, 50));
  }

  return observe(actor); // Timeout - return current state
}
```

## Agent Loop Pattern

```typescript
async function playGame(maxAttempts = 100) {
  // 1. Create and start actor
  const actor = createActor(gameMachine, {
    input: { puzzleIndex: 0 }
  });
  actor.start();

  // 2. Observe initial state
  let obs = observe(actor);
  console.log(`Puzzle: ${obs.letters.join(' ')}`);

  // 3. Track attempts
  const triedWords = new Set<string>();
  let attempts = 0;

  // 4. Main loop
  for (const word of WORD_CANDIDATES) {
    if (attempts >= maxAttempts) break;
    if (triedWords.has(word.toLowerCase())) continue;

    triedWords.add(word.toLowerCase());
    const prevScore = obs.score;

    // 5. Send event (don't pre-validate!)
    actor.send({ type: 'SUBMIT_WORD', word });
    attempts++;

    // 6. Wait for result
    obs = await waitForResult(actor);

    // 7. Learn from feedback
    if (obs.score > prevScore) {
      console.log(`✓ ${word} (+${obs.score - prevScore})`);
    }
    // Agent could also learn from obs.lastMessage for rejections
  }

  // 8. Cleanup
  actor.stop();

  return {
    score: obs.score,
    words: obs.foundWords,
    attempts,
  };
}
```

## Word Candidates

Agent tries words without pre-validating:

```typescript
// Agent doesn't know which are valid - just tries them
const WORD_CANDIDATES = [
  // Potential pangrams (try first - highest value)
  'cracking', 'cranking', 'racking', 'carking',

  // Long words
  'ranking', 'racking', 'kicking', 'nicking',

  // Medium words
  'crack', 'crank', 'rank', 'rack', 'kick',

  // Short words
  'king', 'ring', 'grin', 'rain', 'gain',
];
```

**Key insight:** The agent doesn't call `validateWordRules()` - it just tries words and observes what happens. This is how a human plays.

## Learning from Feedback

The machine provides feedback via context:

```typescript
// After sending SUBMIT_WORD
obs = await waitForResult(actor);

if (obs.score > prevScore) {
  // Word was accepted
  const points = obs.score - prevScore;
  console.log(`Accepted: ${word} (+${points})`);
} else {
  // Word was rejected - learn why
  console.log(`Rejected: ${word} - ${obs.lastMessage}`);

  // Could use this to avoid similar mistakes:
  // - "Not a valid English word" → word not in dictionary
  // - "Already found!" → don't retry this word
  // - "Must include center letter" → word missing required letter
}
```

## Use Consolidated Events

The machine provides `SUBMIT_WORD` for agents:

```typescript
// ❌ Bad: Multiple events like a human typing
actor.send({ type: 'ADD_LETTER', letter: 'R' });
actor.send({ type: 'ADD_LETTER', letter: 'A' });
actor.send({ type: 'ADD_LETTER', letter: 'C' });
actor.send({ type: 'ADD_LETTER', letter: 'K' });
actor.send({ type: 'SUBMIT' });

// ✅ Good: Single consolidated event
actor.send({ type: 'SUBMIT_WORD', word: 'RACK' });
```

## Complete Agent Example

```typescript
import { createActor } from 'xstate';
import { pangramMachine } from './machine.js';

const WORD_CANDIDATES = [
  'cracking', 'cranking', 'racking', 'carking',
  'ranking', 'kicking', 'raking', 'caking',
  'crack', 'crank', 'rack', 'kick', 'king',
  'ring', 'rank', 'rink', 'rick', 'nick',
];

function observe(actor: ReturnType<typeof createActor<typeof pangramMachine>>) {
  const snapshot = actor.getSnapshot();
  return {
    letters: snapshot.context.letters,
    centerLetter: snapshot.context.centerLetter,
    score: snapshot.context.score,
    foundWords: snapshot.context.foundWords,
    lastMessage: snapshot.context.lastMessage,
    isValidating: snapshot.value === 'validating',
  };
}

async function waitForResult(actor: ReturnType<typeof createActor<typeof pangramMachine>>) {
  while (observe(actor).isValidating) {
    await new Promise(r => setTimeout(r, 50));
  }
  return observe(actor);
}

async function playPangram() {
  console.log('PANGRAM AGENT');
  console.log('='.repeat(40));

  const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
  actor.start();

  let obs = observe(actor);
  console.log(`Puzzle: ${obs.letters.join(' ')} (center: ${obs.centerLetter})`);

  const tried = new Set<string>();

  for (const word of WORD_CANDIDATES) {
    if (tried.has(word)) continue;
    tried.add(word);

    const prevScore = obs.score;
    actor.send({ type: 'SUBMIT_WORD', word });
    obs = await waitForResult(actor);

    if (obs.score > prevScore) {
      console.log(`  ✓ [+${obs.score - prevScore}] ${word.toUpperCase()}`);
    }
  }

  console.log('='.repeat(40));
  console.log(`Final score: ${obs.score}`);
  console.log(`Words: ${obs.foundWords.join(', ')}`);

  actor.stop();
  return { score: obs.score, words: obs.foundWords };
}

export { playPangram, observe, waitForResult };
playPangram();
```

## Running the Agent

```bash
pnpm build
npx tsx games/pangram/src/agent.ts
```

## Testing Agents

Test that agents achieve minimum performance:

```typescript
// src/agent.test.ts
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { pangramMachine } from './machine.js';

describe('Agent Benchmarks', () => {
  it('finds at least 10 words', async () => {
    const actor = createActor(pangramMachine, { input: { puzzleIndex: 0 } });
    actor.start();

    for (const word of WORDS_TO_TRY) {
      actor.send({ type: 'SUBMIT_WORD', word });
      await waitForPlaying(actor);
    }

    expect(actor.getSnapshot().context.foundWords.length).toBeGreaterThanOrEqual(10);
    actor.stop();
  });

  it('scores at least 50 points', async () => {
    // ...
  });

  it('finds at least 1 pangram', async () => {
    // ...
  });
});
```

## Guidelines

1. **Same interface as humans** - Send events, observe context
2. **Don't call mechanics** - Let the machine validate
3. **Use consolidated events** - `SUBMIT_WORD` not multiple `ADD_LETTER`
4. **Learn from feedback** - Check score changes and error messages
5. **Wait for async** - Poll `isValidating` before next action
6. **Track attempts** - Avoid retrying failed words
7. **Test performance** - Benchmark minimum thresholds

## Reference

See [`games/pangram/src/agent.ts`](../games/pangram/src/agent.ts) for a complete example.
