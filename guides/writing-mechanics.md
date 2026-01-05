# Writing Game Mechanics

Mechanics are **pure functions** that define game logic. They have no side effects, no state, and are easy to test.

## Why Pure Functions?

```typescript
// Pure: same input → same output, no side effects
function calculateScore(word: string): number {
  return word.length >= 4 ? word.length : 1;
}

// Impure: depends on external state
let multiplier = 1;
function calculateScore(word: string): number {
  return word.length * multiplier; // Bad: depends on external variable
}
```

Benefits:
- **Testable** - No mocking required
- **Reusable** - Machine, UI, and agent all use the same functions
- **Predictable** - No hidden state changes

## File Structure

```typescript
// src/mechanics.ts

// ============================================================================
// Types
// ============================================================================

export interface GameState {
  // Define your game's core data structures
}

// ============================================================================
// Validation Functions
// ============================================================================

export function isValidMove(/*...*/): boolean { /*...*/ }

// ============================================================================
// Scoring Functions
// ============================================================================

export function calculateScore(/*...*/): number { /*...*/ }

// ============================================================================
// Game Data / Puzzles
// ============================================================================

export const PUZZLES = [/*...*/];
```

## Types of Mechanics Functions

### 1. Validation Functions

Return `boolean` or `{ valid: boolean; reason?: string }`:

```typescript
// Simple boolean
export function containsCenterLetter(word: string, centerLetter: string): boolean {
  return word.toLowerCase().includes(centerLetter.toLowerCase());
}

// With error reason (better for UI feedback)
export function validateWordRules(
  word: string,
  letters: string[],
  centerLetter: string,
  foundWords: string[]
): { valid: true } | { valid: false; reason: string } {
  if (word.length < 4) {
    return { valid: false, reason: 'Too short! Need 4+ letters' };
  }
  if (!containsCenterLetter(word, centerLetter)) {
    return { valid: false, reason: `Must include center letter: ${centerLetter}` };
  }
  if (foundWords.includes(word.toLowerCase())) {
    return { valid: false, reason: 'Already found!' };
  }
  return { valid: true };
}
```

### 2. Scoring Functions

Calculate points from game state:

```typescript
export function calculateWordScore(word: string, letters: string[]): number {
  let points = word.length;

  // 4-letter words are only worth 1 point
  if (word.length === 4) {
    points = 1;
  }

  // Pangrams get 7 bonus points
  if (isPangram(word, letters)) {
    points += 7;
  }

  return points;
}
```

### 3. State Query Functions

Extract information from game state:

```typescript
export function getWordStats(foundWords: string[], letters: string[]): {
  totalWords: number;
  totalPangrams: number;
  averageLength: number;
} {
  const pangrams = foundWords.filter(w => isPangram(w, letters));
  return {
    totalWords: foundWords.length,
    totalPangrams: pangrams.length,
    averageLength: foundWords.length > 0
      ? foundWords.reduce((sum, w) => sum + w.length, 0) / foundWords.length
      : 0,
  };
}
```

### 4. Data Generation Functions

Create or retrieve game data:

```typescript
export function getPuzzle(index: number): Puzzle {
  return PUZZLES[index % PUZZLES.length];
}

export function createCustomPuzzle(
  letters: string[],
  centerLetter: string
): Puzzle | { error: string } {
  if (letters.length !== 7) {
    return { error: 'Must have exactly 7 letters' };
  }
  // ... validation ...
  return { letters, centerLetter };
}
```

### 5. Async Validation (Special Case)

External API calls are the **one exception** to pure functions:

```typescript
export async function validateWordDictionary(word: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`
    );
    return response.ok;
  } catch {
    return false; // Fail closed on network error
  }
}
```

**Note:** Async functions should be called from the machine's `fromPromise` actor, not directly from UI.

## Testing Mechanics

Mechanics are the easiest code to test:

```typescript
// src/mechanics.test.ts
import { describe, it, expect } from 'vitest';
import { isPangram, calculateWordScore, validateWordRules } from './mechanics.js';

describe('isPangram', () => {
  const letters = ['R', 'A', 'C', 'K', 'I', 'N', 'G'];

  it('returns true when word uses all letters', () => {
    expect(isPangram('cracking', letters)).toBe(true);
    expect(isPangram('racking', letters)).toBe(false);
  });
});

describe('calculateWordScore', () => {
  const letters = ['R', 'A', 'C', 'K', 'I', 'N', 'G'];

  it('scores 4-letter words as 1 point', () => {
    expect(calculateWordScore('rack', letters)).toBe(1);
  });

  it('scores longer words by length', () => {
    expect(calculateWordScore('racking', letters)).toBe(7);
  });

  it('adds 7 bonus points for pangrams', () => {
    expect(calculateWordScore('cracking', letters)).toBe(15); // 8 + 7
  });
});

describe('validateWordRules', () => {
  const letters = ['R', 'A', 'C', 'K', 'I', 'N', 'G'];
  const centerLetter = 'K';

  it('rejects words without center letter', () => {
    const result = validateWordRules('rain', letters, centerLetter, []);
    expect(result).toEqual({ valid: false, reason: expect.stringContaining('center') });
  });

  it('rejects already found words', () => {
    const result = validateWordRules('rack', letters, centerLetter, ['rack']);
    expect(result).toEqual({ valid: false, reason: 'Already found!' });
  });
});
```

## Guidelines

1. **No side effects** - Don't modify external state
2. **No `this`** - Use plain functions, not classes
3. **Return new objects** - Don't mutate inputs
4. **Handle edge cases** - Empty arrays, null values, etc.
5. **Use TypeScript** - Type your inputs and outputs
6. **Keep functions small** - One responsibility per function
7. **Export everything** - Machine, UI, agent, and tests all need access

## Reference

See [`games/pangram/src/mechanics.ts`](../games/pangram/src/mechanics.ts) for a complete example.
