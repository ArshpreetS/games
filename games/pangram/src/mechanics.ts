/**
 * Pangram Game Mechanics
 * Pure functions for game logic - no state, no side effects
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ============================================================================
// Puzzle Data
// ============================================================================

export interface Puzzle {
  letters: string[];
  centerLetter: string;
}

export const PUZZLES: Puzzle[] = [
  { letters: ['R', 'A', 'C', 'K', 'I', 'N', 'G'], centerLetter: 'K' },
  { letters: ['P', 'L', 'A', 'Y', 'I', 'N', 'G'], centerLetter: 'Y' },
  { letters: ['T', 'R', 'A', 'V', 'E', 'L', 'S'], centerLetter: 'V' },
  { letters: ['Q', 'U', 'I', 'C', 'K', 'L', 'Y'], centerLetter: 'Q' },
  { letters: ['J', 'U', 'M', 'P', 'I', 'N', 'G'], centerLetter: 'J' },
  { letters: ['S', 'T', 'R', 'O', 'N', 'G', 'E'], centerLetter: 'G' },
  { letters: ['B', 'R', 'I', 'G', 'H', 'T', 'S'], centerLetter: 'B' },
  { letters: ['C', 'L', 'O', 'U', 'D', 'S', 'Y'], centerLetter: 'Y' },
  { letters: ['W', 'A', 'T', 'E', 'R', 'S', 'Y'], centerLetter: 'W' },
  { letters: ['M', 'A', 'R', 'K', 'E', 'T', 'S'], centerLetter: 'K' },
];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a word is a pangram (uses all 7 letters)
 */
export function isPangram(word: string, letters: string[]): boolean {
  const letterSet = new Set(letters.map(l => l.toLowerCase()));
  const wordLetters = new Set(word.toLowerCase());

  for (const letter of letterSet) {
    if (!wordLetters.has(letter)) return false;
  }
  return true;
}

/**
 * Check if a word only uses letters from the available set
 */
export function usesOnlyAvailableLetters(word: string, letters: string[]): boolean {
  const letterSet = new Set(letters.map(l => l.toLowerCase()));
  for (const char of word.toLowerCase()) {
    if (!letterSet.has(char)) return false;
  }
  return true;
}

/**
 * Check if a word contains the center letter
 */
export function containsCenterLetter(word: string, centerLetter: string): boolean {
  return word.toLowerCase().includes(centerLetter.toLowerCase());
}

/**
 * Validate a word against basic rules (not dictionary)
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function validateWordRules(
  word: string,
  letters: string[],
  centerLetter: string,
  foundWords: string[]
): { valid: true } | { valid: false; reason: string } {
  const normalizedWord = word.toLowerCase();

  if (normalizedWord.length < 4) {
    return { valid: false, reason: 'Too short! Need 4+ letters' };
  }

  if (!containsCenterLetter(normalizedWord, centerLetter)) {
    return { valid: false, reason: `Must include center letter: ${centerLetter}` };
  }

  if (!usesOnlyAvailableLetters(normalizedWord, letters)) {
    return { valid: false, reason: 'Uses letters not in the puzzle' };
  }

  if (foundWords.includes(normalizedWord)) {
    return { valid: false, reason: 'Already found!' };
  }

  return { valid: true };
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate points for a word
 */
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

/**
 * Get statistics about found words
 */
export function getWordStats(foundWords: string[], letters: string[]): {
  totalWords: number;
  totalPangrams: number;
  averageLength: number;
  uniqueLettersUsed: number;
} {
  const pangrams = foundWords.filter(w => isPangram(w, letters));
  const allLetters = foundWords.join('').toLowerCase();
  const uniqueLetters = new Set(allLetters);

  return {
    totalWords: foundWords.length,
    totalPangrams: pangrams.length,
    averageLength: foundWords.length > 0
      ? foundWords.reduce((sum, w) => sum + w.length, 0) / foundWords.length
      : 0,
    uniqueLettersUsed: uniqueLetters.size,
  };
}

// ============================================================================
// Dictionary Validation
// ============================================================================

// Load dictionary once at module initialization
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dictionaryPath = join(__dirname, 'dictionary.txt');

let DICTIONARY: Set<string>;
try {
  const words = readFileSync(dictionaryPath, 'utf-8')
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0);
  DICTIONARY = new Set(words);
  console.log(`Dictionary loaded: ${DICTIONARY.size} words`);
} catch {
  console.warn('Dictionary not found, using empty set');
  DICTIONARY = new Set();
}

/**
 * Validate word against local Scrabble dictionary
 */
export async function validateWordDictionary(word: string): Promise<boolean> {
  return DICTIONARY.has(word.toLowerCase());
}

// ============================================================================
// Puzzle Generation
// ============================================================================

/**
 * Get a puzzle by index (wraps around)
 */
export function getPuzzle(index: number): Puzzle {
  return PUZZLES[index % PUZZLES.length];
}

/**
 * Get a random puzzle
 */
export function getRandomPuzzle(seed?: number): Puzzle {
  const index = seed !== undefined
    ? Math.abs(seed) % PUZZLES.length
    : Math.floor(Math.random() * PUZZLES.length);
  return PUZZLES[index];
}

/**
 * Create a custom puzzle (validates the configuration)
 */
export function createCustomPuzzle(
  letters: string[],
  centerLetter: string
): Puzzle | { error: string } {
  if (letters.length !== 7) {
    return { error: 'Must have exactly 7 letters' };
  }

  const upperLetters = letters.map(l => l.toUpperCase());
  const upperCenter = centerLetter.toUpperCase();

  if (!upperLetters.includes(upperCenter)) {
    return { error: 'Center letter must be one of the 7 letters' };
  }

  const uniqueLetters = new Set(upperLetters);
  if (uniqueLetters.size !== 7) {
    return { error: 'All 7 letters must be unique' };
  }

  return {
    letters: upperLetters,
    centerLetter: upperCenter,
  };
}

// ============================================================================
// Text Generation (for LLM agents)
// ============================================================================

/**
 * Generate a text description of the current game state
 */
export function generateStateText(
  letters: string[],
  centerLetter: string,
  foundWords: string[],
  score: number,
  currentInput: string
): string {
  const lines = [
    `Letters: ${letters.join(', ')} (center: ${centerLetter})`,
    `Score: ${score}`,
    `Words found (${foundWords.length}): ${foundWords.join(', ') || 'none'}`,
  ];

  if (currentInput) {
    lines.push(`Current input: ${currentInput}`);
  }

  const stats = getWordStats(foundWords, letters);
  if (stats.totalPangrams > 0) {
    lines.push(`Pangrams found: ${stats.totalPangrams}`);
  }

  return lines.join('\n');
}
