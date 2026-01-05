/**
 * Generic Benchmark Runner
 *
 * Runs any LLM against the game with:
 * - Game tools (get_game_state, submit_word)
 * - Code sandbox tool (JavaScript via Vercel Sandbox)
 * - Full metrics tracking (tokens, iterations, tool calls)
 *
 * Usage:
 *   GOOGLE_GENERATIVE_AI_API_KEY=... npx tsx games/pangram/src/benchmark.ts
 *
 * With Vercel Sandbox (for code execution):
 *   vercel link && vercel env pull
 *   GOOGLE_GENERATIVE_AI_API_KEY=... npx tsx games/pangram/src/benchmark.ts
 *
 * The LLM decides its own strategy - it can:
 * - Call game tools directly
 * - Write JavaScript code to generate word candidates
 * - Fetch word lists from the internet
 * - Analyze patterns and iterate
 */

import { ToolLoopAgent, tool, stepCountIs } from 'ai';
import { Sandbox } from '@vercel/sandbox';
import { z } from 'zod';
import { createActor } from 'xstate';
import { pangramMachine } from './machine.js';
import { getGameConfig, generateSystemPrompt } from './game-config.js';

// ============================================================================
// Types
// ============================================================================

export interface BenchmarkConfig {
  provider: 'google' | 'anthropic';
  model: string;
  maxSteps: number;
  puzzleIndex: number;
  enableCodeExecution: boolean;
}

export interface BenchmarkResult {
  config: BenchmarkConfig;
  game: {
    score: number;
    wordsFound: string[];
    pangrams: string[];
  };
  metrics: {
    tokens: { input: number; output: number; total: number };
    iterations: number;
    toolCalls: { total: number; get_game_state: number; submit_word: number; execute_code: number };
    efficiency: number;
    duration: number;
  };
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: BenchmarkConfig = {
  provider: 'google',
  model: 'gemini-2.5-flash',
  maxSteps: 30,
  puzzleIndex: 0,
  enableCodeExecution: true,
};

// ============================================================================
// Model String Factory
// ============================================================================

function getModelString(config: BenchmarkConfig): string {
  // AI SDK 6 uses provider/model format
  return `${config.provider}/${config.model}`;
}

// ============================================================================
// Benchmark Runner
// ============================================================================

export async function runBenchmark(
  config: Partial<BenchmarkConfig> = {}
): Promise<BenchmarkResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // Load game config
  const gameConfig = getGameConfig();
  const systemPrompt = generateSystemPrompt(gameConfig);

  // Create game actor
  const actor = createActor(pangramMachine, {
    input: { puzzleIndex: finalConfig.puzzleIndex },
  });
  actor.start();

  // Tool call counters
  const toolCallCounts = { get_game_state: 0, submit_word: 0, execute_code: 0 };

  // Helper to observe game state
  const observeGame = () => {
    toolCallCounts.get_game_state++;
    const snapshot = actor.getSnapshot();
    const ctx = snapshot.context;
    return {
      letters: ctx.letters,
      centerLetter: ctx.centerLetter,
      score: ctx.score,
      foundWords: ctx.foundWords,
      lastMessage: ctx.lastMessage,
    };
  };

  // Helper to submit word
  const submitWord = async (word: string) => {
    toolCallCounts.submit_word++;
    const prevScore = actor.getSnapshot().context.score;
    actor.send({ type: 'SUBMIT_WORD', word });

    // Wait for validation
    while (actor.getSnapshot().value === 'validating') {
      await new Promise((r) => setTimeout(r, 50));
    }

    const snapshot = actor.getSnapshot();
    return {
      accepted: snapshot.context.score > prevScore,
      pointsEarned: snapshot.context.score - prevScore,
      message: snapshot.context.lastMessage,
      newScore: snapshot.context.score,
    };
  };

  // Create sandbox for code execution (if enabled)
  let sandbox: Sandbox | null = null;
  if (finalConfig.enableCodeExecution) {
    try {
      sandbox = await Sandbox.create({
        runtime: 'node22',
        timeout: 60_000, // 60 second timeout
      });
      console.log(`Sandbox created: ${sandbox.sandboxId}`);
    } catch (err) {
      console.log('Sandbox creation failed (requires VERCEL_OIDC_TOKEN). Code execution disabled.');
      finalConfig.enableCodeExecution = false;
    }
  }

  // Code execution using Vercel Sandbox
  const executeCode = async (code: string) => {
    toolCallCounts.execute_code++;
    if (!sandbox) {
      return {
        success: false,
        output: 'Sandbox not available. Set VERCEL_OIDC_TOKEN to enable.',
        error: 'NO_SANDBOX',
      };
    }
    try {
      // Run JavaScript code in the sandbox
      const result = await sandbox.runCommand({
        cmd: 'node',
        args: ['-e', code],
      });
      const output = await result.stdout();
      const stderr = await result.stderr();
      return {
        success: result.exitCode === 0,
        output: output || stderr,
        exitCode: result.exitCode,
        error: result.exitCode !== 0 ? stderr : null,
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  };

  // Define tools using inputSchema (AI SDK 6 syntax)
  const tools = {
    get_game_state: tool({
      description: 'Get the current game state including available letters, center letter, score, and found words. Call this first to see what letters you have.',
      inputSchema: z.object({
        format: z.string().describe('Output format: use "brief" or "detailed"'),
      }),
      execute: async () => observeGame(),
    }),
    submit_word: tool({
      description: 'Submit a word to score points. Must be 4+ letters, use only available letters, include center letter.',
      inputSchema: z.object({
        word: z.string().describe('The word to submit'),
      }),
      execute: async ({ word }) => submitWord(word),
    }),
    ...(finalConfig.enableCodeExecution ? {
      execute_code: tool({
        description: 'Execute JavaScript code in a sandboxed Node.js environment. Use this to generate word candidates, analyze patterns, or fetch word lists. Use console.log() to output results.',
        inputSchema: z.object({
          code: z.string().describe('JavaScript code to execute'),
        }),
        execute: async ({ code }) => executeCode(code),
      }),
    } : {}),
  };

  // Print header
  console.log('='.repeat(60));
  console.log('BENCHMARK RUNNER');
  console.log('='.repeat(60));
  console.log(`Provider: ${finalConfig.provider}`);
  console.log(`Model: ${finalConfig.model}`);
  console.log(`Max Steps: ${finalConfig.maxSteps}`);
  console.log(`Puzzle: ${finalConfig.puzzleIndex}`);
  console.log(`Code Execution: ${finalConfig.enableCodeExecution ? 'enabled' : 'disabled'}`);

  const initial = observeGame();
  toolCallCounts.get_game_state--; // Don't count initial observation
  console.log(`\nLetters: ${initial.letters.join(' ')} (center: ${initial.centerLetter})`);
  console.log('');

  // Create the agent using ToolLoopAgent (AI SDK 6)
  const agent = new ToolLoopAgent({
    model: getModelString(finalConfig),
    instructions: systemPrompt,
    tools,
    stopWhen: stepCountIs(finalConfig.maxSteps),
  });

  // Run the agent
  const result = await agent.generate({
    prompt: `Play the game and maximize your score.`,
  });

  // Log tool calls from steps
  for (const step of result.steps) {
    if (step.toolCalls) {
      for (const tc of step.toolCalls) {
        if (!tc) continue;
        if (tc.toolName === 'submit_word') {
          const res = step.toolResults?.find((r) => r && 'toolCallId' in r && r.toolCallId === tc.toolCallId);
          if (res && 'output' in res && typeof res.output === 'object' && res.output !== null) {
            const r = res.output as { accepted: boolean; pointsEarned: number };
            const word = (tc.input as { word: string }).word;
            if (r.accepted) {
              console.log(`  ✓ [+${r.pointsEarned}] ${word.toUpperCase()}`);
            } else {
              console.log(`  ✗ ${word}`);
            }
          }
        } else if (tc.toolName === 'execute_code') {
          const code = (tc.input as { code: string }).code;
          console.log(`  🐍 Code executed:\n${code.split('\n').map(l => '     ' + l).join('\n')}`);
          const res = step.toolResults?.find((r) => r && 'toolCallId' in r && r.toolCallId === tc.toolCallId);
          if (res && 'output' in res && typeof res.output === 'object' && res.output !== null) {
            const r = res.output as { output: string };
            if (r.output) {
              console.log(`  📤 Output: ${r.output.slice(0, 500)}${r.output.length > 500 ? '...' : ''}`);
            }
          }
        }
      }
    }
  }

  // Get final state and cleanup
  const finalState = actor.getSnapshot();
  actor.stop();

  // Stop sandbox if it was created
  if (sandbox) {
    await sandbox.stop();
    console.log('Sandbox stopped');
  }

  // Calculate metrics - handle different provider formats
  const inputTokens = result.usage?.inputTokens ?? 0;
  const outputTokens = result.usage?.outputTokens ?? 0;
  const totalTokens = result.usage?.totalTokens ?? (inputTokens + outputTokens);
  const score = finalState.context.score;
  const duration = Date.now() - startTime;

  const totalToolCalls = toolCallCounts.get_game_state + toolCallCounts.submit_word + toolCallCounts.execute_code;

  // Identify pangrams
  const pangrams = finalState.context.foundWords.filter((w: string) => w.length >= 7);

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Score: ${score}`);
  console.log(`Words: ${finalState.context.foundWords.length}`);
  console.log(`Pangrams: ${pangrams.length}`);
  console.log(`\nTokens: ${totalTokens} (in: ${inputTokens}, out: ${outputTokens})`);
  console.log(`Iterations: ${result.steps.length}`);
  console.log(`Tool Calls: ${totalToolCalls} (get_state: ${toolCallCounts.get_game_state}, submit: ${toolCallCounts.submit_word}, code: ${toolCallCounts.execute_code})`);
  console.log(`Efficiency: ${(score / (totalTokens / 1000)).toFixed(2)} points/1k tokens`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);

  const benchmarkResult: BenchmarkResult = {
    config: finalConfig,
    game: {
      score,
      wordsFound: finalState.context.foundWords,
      pangrams,
    },
    metrics: {
      tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
      iterations: result.steps.length,
      toolCalls: { total: totalToolCalls, ...toolCallCounts },
      efficiency: score / (totalTokens / 1000),
      duration,
    },
  };

  return benchmarkResult;
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const config: Partial<BenchmarkConfig> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && args[i + 1]) {
      config.provider = args[++i] as 'google' | 'anthropic';
    } else if (args[i] === '--model' && args[i + 1]) {
      config.model = args[++i];
    } else if (args[i] === '--steps' && args[i + 1]) {
      config.maxSteps = parseInt(args[++i], 10);
    } else if (args[i] === '--puzzle' && args[i + 1]) {
      config.puzzleIndex = parseInt(args[++i], 10);
    } else if (args[i] === '--no-code') {
      config.enableCodeExecution = false;
    }
  }

  try {
    const result = await runBenchmark(config);
    console.log('\n' + '='.repeat(60));
    console.log('JSON OUTPUT');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Benchmark error:', error);
    process.exit(1);
  }
}

main();
