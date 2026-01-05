# Agent Benchmarking

Benchmark LLM agents on Game Bench games, tracking **tokens vs correctness**.

## Evaluation Framework

Each game defines its own **correctness metric** (0-100%). The benchmark measures how efficiently an agent achieves correctness.

### Core Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| **Correctness** | Game-specific (0-100%) | How well the agent solved the game |
| **Tokens** | Input + Output | Total tokens consumed |
| **Efficiency** | Correctness / (Tokens / 1000) | Correctness % per 1k tokens |

### Secondary Metrics

| Metric | Description |
|--------|-------------|
| **Iterations** | Number of LLM calls (agent loop steps) |
| **Tool Calls** | Breakdown by tool type |
| **Duration** | Wall clock time |

### Generic Evaluation Rubric

| Dimension | Excellent | Good | Fair | Poor |
|-----------|-----------|------|------|------|
| **Correctness** | 90-100% | 70-89% | 40-69% | <40% |
| **Efficiency** | >5%/1k tokens | 2-5%/1k | 0.5-2%/1k | <0.5%/1k |
| **Strategy** | Optimal tool use | Good tool use | Suboptimal | Stuck/failing |
| **Tool Usage** | Minimal wasted calls | <20% wasted | 20-50% wasted | >50% wasted |

## Game-Specific Correctness

Each game must define how correctness is calculated:

```typescript
interface GameMetrics {
  // Raw game-specific score (e.g., points, moves, completion)
  rawScore: number;
  // Maximum possible score for this game instance
  maxScore: number;
  // Correctness as percentage (0-100)
  correctness: number; // = (rawScore / maxScore) * 100
}
```

### Example: Pangram

```typescript
// Pangram correctness = score / theoretical max score
// Theoretical max depends on puzzle (all valid words found)
correctness = (score / maxPossibleScore) * 100;
```

### Example: Chess Puzzle

```typescript
// Chess correctness = optimal moves / total moves
correctness = isCheckmate ? 100 : 0;
// Or for tactical puzzles: (optimalMoves / playerMoves) * 100
```

### Example: Code Generation

```typescript
// Code correctness = tests passed / total tests
correctness = (testsPassed / totalTests) * 100;
```

## Running Benchmarks

```bash
# Generic pattern
PROVIDER_API_KEY=... npx tsx games/<game>/src/benchmark.ts \
  --provider <provider> \
  --model <model> \
  --steps <max-steps>

# Example: Pangram with Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=... npx tsx games/pangram/src/benchmark.ts \
  --provider google \
  --model gemini-2.5-flash \
  --steps 30

# Example: Pangram with Anthropic
ANTHROPIC_API_KEY=sk-... npx tsx games/pangram/src/benchmark.ts \
  --provider anthropic \
  --model claude-sonnet-4-20250514 \
  --steps 30
```

## Standard Tools

Games should provide these standard tool types:

| Tool | Purpose |
|------|---------|
| `observe` / `get_state` | Get current game state |
| `act` / `submit` | Take an action in the game |
| `execute_code` (optional) | Run code in sandbox |

## Output Format

```json
{
  "config": {
    "game": "pangram",
    "provider": "google",
    "model": "gemini-2.5-flash",
    "maxSteps": 30
  },
  "results": {
    "rawScore": 110,
    "maxScore": 250,
    "correctness": 44.0,
    "gameSpecific": { }
  },
  "metrics": {
    "tokens": { "input": 2500, "output": 724, "total": 3224 },
    "iterations": 25,
    "toolCalls": { "total": 25, "observe": 1, "act": 23, "execute_code": 1 },
    "efficiency": 13.64,
    "duration": 92164
  }
}
```

## Implementation

Use [Vercel AI SDK 6](https://sdk.vercel.ai/) for the agent loop:

```typescript
import { ToolLoopAgent, tool, stepCountIs } from 'ai';
import { Sandbox } from '@vercel/sandbox';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: `${provider}/${model}`,
  instructions: gameSystemPrompt,
  tools: gameTools,
  stopWhen: stepCountIs(maxSteps),
});

const result = await agent.generate({
  prompt: 'Play the game and maximize your score.',
});

// Extract metrics
const metrics = {
  tokens: result.usage,
  iterations: result.steps.length,
  // ...
};
```

## Performance Insights

Based on agent evaluation research, three factors explain ~95% of performance variance:

| Factor | Impact | Implication |
|--------|--------|-------------|
| Token budget | ~80% | More tokens = better performance |
| Tool calls | ~10% | More exploration helps |
| Model choice | ~5% | Better models multiply efficiency |

## References

- [ARC Prize](https://arcprize.org/leaderboard) - Cost-per-task efficiency benchmarking
- [Vercel AI SDK 6](https://sdk.vercel.ai/) - Agent framework
- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) - Safe code execution
