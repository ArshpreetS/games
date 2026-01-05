# Game Bench

A framework for building agent-playable games with XState state machines.

## Live Games

| Game | Link |
|------|------|
| Pangram | [pangram.fun.theflywheel.in](https://pangram.fun.theflywheel.in) |

## Architecture

```
├── games/pangram/          # Word puzzle game (NYT Spelling Bee style)
│   ├── src/
│   │   ├── mechanics.ts    # Pure game logic (validation, scoring)
│   │   ├── machine.ts      # XState v5 state machine
│   │   ├── agent.ts        # AI agent that plays the game
│   │   └── ui/             # React components
├── apps/web/               # Vite + React web app
├── packages/
│   ├── protocol/           # JSON-RPC message types
│   └── transport/          # Communication adapters
```

## The Pangram Game

Find words using 7 letters, always including the center letter. Pangrams (using all 7) score bonus points.

### Key Files

| File | Purpose |
|------|---------|
| [`mechanics.ts`](games/pangram/src/mechanics.ts) | Pure functions: `validateWordRules`, `calculateWordScore`, `isPangram` |
| [`machine.ts`](games/pangram/src/machine.ts) | XState machine with `playing` and `validating` states |
| [`agent.ts`](games/pangram/src/agent.ts) | Agent that plays via `SUBMIT_WORD` events |
| [`ui/PangramGame.tsx`](games/pangram/src/ui/PangramGame.tsx) | React UI using `@xstate/react` |

### Machine Events

```typescript
type PangramEvent =
  | { type: 'ADD_LETTER'; letter: string }  // Human typing
  | { type: 'DELETE_LETTER' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_WORD'; word: string }   // Agent shortcut
  | { type: 'NEW_PUZZLE' };
```

### Permissive Design

The machine accepts any input and provides feedback instead of blocking:
- Invalid letters are silently ignored
- Short words return error messages (not rejected)
- Agents observe results via context changes

## Running Agents

### Simple Agent (no LLM)
```bash
npx tsx games/pangram/src/agent.ts
```

### LLM Agent Benchmark
```bash
# With Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=... npx tsx games/pangram/src/benchmark.ts

# With Anthropic
ANTHROPIC_API_KEY=sk-... npx tsx games/pangram/src/benchmark.ts \
  --provider anthropic --model claude-sonnet-4-20250514
```

Output includes metrics:
```json
{
  "score": 110,
  "tokens": { "input": 2500, "output": 724, "total": 3224 },
  "iterations": 25,
  "toolCalls": { "total": 25, "get_game_state": 1, "submit_word": 23, "execute_code": 1 },
  "efficiency": 34.12
}
```

## Commands

```bash
pnpm install      # Install dependencies
pnpm dev          # Start dev server (localhost:5173)
pnpm build        # Build all packages
pnpm test         # Run tests (48 tests across 3 files)
pnpm typecheck    # TypeScript validation
```

## Design Principles

1. **Same interface for humans and agents** - Both use machine events
2. **Pure mechanics** - Game logic separated from state management
3. **Permissive machines** - Accept input, provide feedback
4. **Observable state** - Agents learn from context changes

## Tech Stack

- **XState v5** - State machines with `setup()`, `fromPromise()`
- **React 19** - UI with `@xstate/react`
- **Tailwind CSS 4** - Styling
- **Vitest** - Testing
- **Turbo** - Monorepo build orchestration
- **pnpm** - Package management

## CI/CD

GitHub Actions: `typecheck` → `test` → `build` on every push.

## Guides

- [Adding a New Game](guides/adding-a-new-game.md)
- [Writing Mechanics](guides/writing-mechanics.md) - Pure game logic
- [Writing Machines](guides/writing-machines.md) - XState v5 state machines
- [Writing UI](guides/writing-ui.md) - React components
- [Writing Agents](guides/writing-agents.md) - AI agents that play games
- [Agent Benchmarking](guides/agent-benchmarking.md) - Token tracking and evaluation

See [`CLAUDE.md`](CLAUDE.md) for AI assistant instructions.
