# Adding a New Game

This guide walks through adding a new game to Game Bench.

## Overview

Each game is a package in `games/` with:
- **mechanics.ts** - Pure game logic (validation, scoring)
- **machine.ts** - XState v5 state machine
- **ui/** - React components
- **agent.ts** - AI agent that plays the game (optional)
- **tests** - Vitest tests

## Step 1: Create the Game Package

```bash
mkdir -p games/<game-name>/src/ui
cd games/<game-name>
```

Create `package.json`:
```json
{
  "name": "@game-bench/<game-name>",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./ui": {
      "types": "./dist/ui/index.d.ts",
      "import": "./dist/ui/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts src/ui/index.ts --format esm --dts",
    "dev": "tsup src/index.ts src/ui/index.ts --format esm --dts --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "xstate": "^5.25.0"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "react": "^19.0.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^4.0.16"
  }
}
```

Create `tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

## Step 2: Write Game Mechanics

Create `src/mechanics.ts` with pure functions:

```typescript
// Types
export interface GameState {
  // Define your game state
}

// Pure validation functions
export function isValidMove(state: GameState, move: Move): boolean {
  // Return true/false, no side effects
}

// Pure scoring functions
export function calculateScore(state: GameState): number {
  // Compute score from state
}
```

**Key principles:**
- No side effects
- No async operations
- Easy to test
- Used by both machine and agent

## Step 3: Create the State Machine

Create `src/machine.ts`:

```typescript
import { setup, assign, fromPromise } from 'xstate';
import { isValidMove, calculateScore } from './mechanics.js';

export interface GameContext {
  score: number;
  // ... other state
}

export type GameEvent =
  | { type: 'MAKE_MOVE'; move: Move }
  | { type: 'RESET' };

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    input: {} as { /* initial config */ },
  },
  actions: {
    // Define actions
  },
  guards: {
    // Define guards (optional - prefer permissive design)
  },
  actors: {
    // Define async actors if needed
  },
}).createMachine({
  id: 'game-name',
  initial: 'playing',
  context: ({ input }) => ({
    score: 0,
    // Initialize from input
  }),
  states: {
    playing: {
      on: {
        MAKE_MOVE: {
          // Permissive: accept input, provide feedback
          actions: assign(({ context, event }) => {
            // Update state
          }),
        },
        RESET: {
          actions: 'resetGame',
        },
      },
    },
  },
});
```

**Design principles:**
- Accept any input, provide feedback (permissive)
- Keep state minimal
- Use `fromPromise` for async validation

## Step 4: Create the UI

Create `src/ui/GameComponent.tsx`:

```tsx
import type { GameContext, GameEvent } from '../machine.js';

interface Props {
  context: GameContext;
  stateValue: string;
  send: (event: GameEvent) => void;
}

export function GameComponent({ context, stateValue, send }: Props) {
  return (
    <div>
      <p>Score: {context.score}</p>
      <button onClick={() => send({ type: 'RESET' })}>
        Reset
      </button>
    </div>
  );
}
```

Create `src/ui/index.ts`:
```typescript
export { GameComponent } from './GameComponent.js';
```

## Step 5: Export from Package

Create `src/index.ts`:
```typescript
export { gameMachine } from './machine.js';
export type { GameContext, GameEvent } from './machine.js';
export * from './mechanics.js';
```

## Step 6: Add Tests

Create `src/mechanics.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidMove, calculateScore } from './mechanics.js';

describe('Game Mechanics', () => {
  it('validates moves correctly', () => {
    expect(isValidMove(state, validMove)).toBe(true);
  });
});
```

Create `src/machine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { gameMachine } from './machine.js';

describe('Game Machine', () => {
  it('starts in playing state', () => {
    const actor = createActor(gameMachine, { input: {} });
    actor.start();
    expect(actor.getSnapshot().value).toBe('playing');
    actor.stop();
  });
});
```

## Step 7: Create an Agent (Optional)

Create `src/agent.ts`:

```typescript
import { createActor } from 'xstate';
import { gameMachine } from './machine.js';

function observe(actor: ReturnType<typeof createActor>) {
  const snapshot = actor.getSnapshot();
  return {
    score: snapshot.context.score,
    // Extract observable state
  };
}

async function playGame() {
  const actor = createActor(gameMachine, { input: {} });
  actor.start();

  // Agent loop: send events, observe results
  actor.send({ type: 'MAKE_MOVE', move: /* ... */ });
  const obs = observe(actor);

  // Learn from feedback (score changes, error messages)

  actor.stop();
}

playGame();
```

**Key principle:** Agent uses the same interface as UI (machine events only).

## Step 8: Wire Up the Web App

In `apps/web/package.json`, add dependency:
```json
{
  "dependencies": {
    "@game-bench/<game-name>": "workspace:*"
  }
}
```

Create a route or update `App.tsx`:
```tsx
import { useMachine } from '@xstate/react';
import { gameMachine } from '@game-bench/<game-name>';
import { GameComponent } from '@game-bench/<game-name>/ui';

function App() {
  const [state, send] = useMachine(gameMachine, { input: {} });

  return (
    <GameComponent
      context={state.context}
      stateValue={state.value as string}
      send={send}
    />
  );
}
```

## Step 9: Build and Test

```bash
pnpm install
pnpm build
pnpm test
pnpm dev
```

## Step 10: Deploy

```bash
vercel --prod
vercel alias set <game-name>.fun.theflywheel.in
```

## Checklist

- [ ] `games/<name>/package.json` created
- [ ] `mechanics.ts` with pure functions
- [ ] `machine.ts` with XState v5 machine
- [ ] `ui/` with React components
- [ ] Tests for mechanics and machine
- [ ] Exported from `index.ts`
- [ ] Web app wired up
- [ ] All tests pass (`pnpm test`)
- [ ] Builds successfully (`pnpm build`)

## Reference

See [`games/pangram/`](../games/pangram/) for a complete example.
