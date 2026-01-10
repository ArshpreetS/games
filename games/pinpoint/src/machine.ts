import { setup } from "xstate";
import { calculateScore, PINPOINT_GAMES } from "./mechanics";

interface PinpointGameContext {
  hintWords: string[];
  currentGuesses: string[];
  gameIndex: number;
  overallScore: number;
}

type PinpointGameEvent =
  | { type: "MAKE_GUESS"; guess: string }
  | { type: "VALIDATE_GUESS" }
  | { type: "NEXT_OPTION" }
  | { type: "FINISH_GAME" };

const pinpointGame = setup({
  types: {
    context: {} as PinpointGameContext,
    events: {} as PinpointGameEvent,
    input: {} as { gameIndex?: number },
  },
  actions: {
    updateGuesses: ({ context, event }) => {
      if (event.type != "MAKE_GUESS") return;

      context.currentGuesses.push(event.guess);
    },
    addNextHint: ({ context }) => {
      const game = PINPOINT_GAMES[context.gameIndex];
      const nextHintIndex = context.hintWords.length;
      if (nextHintIndex < game!.inputWords.length) {
        context.hintWords.push(game!.inputWords[nextHintIndex]!);
      }
    },
    logWin: ({ context }) => {
      const pointScored = calculateScore(context.currentGuesses.length);
      context.overallScore += pointScored;
      console.log(
        `Player guessed correctly! The category was: ${
          PINPOINT_GAMES[context.gameIndex]!.correctAnswer
        }. Points scored: ${pointScored}. Total score: ${context.overallScore}`
      );
    },
    logLoss: ({ context }) => {
      console.log(
        `Player failed to guess. The category was: ${
          PINPOINT_GAMES[context.gameIndex]!.correctAnswer
        }`
      );
    },
  },
  guards: {
    isGuessCorrect: ({ context }) => {
      const game = PINPOINT_GAMES[context.gameIndex];
      const currentGuess =
        context.currentGuesses[
          context.currentGuesses.length - 1
        ]!.toLowerCase().trim();
      console.log(
        `Checking guess "${currentGuess}" against category "${game?.correctAnswer
          .toLowerCase()
          .trim()}"`
      );
      return game?.correctAnswer.toLowerCase().trim() === currentGuess;
    },
    isNextOptionAvailable: ({ context }) => {
      const game = PINPOINT_GAMES[context.gameIndex];
      console.log(
        `Checking if next hint is available. Current hints: ${context.hintWords.length}, Total clues: ${game?.inputWords.length}`
      );
      return context.hintWords.length < game!.inputWords.length;
    },
  },
}).createMachine({
  id: "pinpointGame",
  initial: "start",
  context: ({ input }) => {
    const gameInd = input?.gameIndex || 0;
    return {
      hintWords: [],
      currentGuesses: [],
      gameIndex: gameInd,
      overallScore: 0,
    };
  },
  states: {
    start: {
      entry: ["addNextHint"],
      always: "playing",
    },
    playing: {
      on: {
        MAKE_GUESS: {
          target: "validating",
          actions: ["updateGuesses"],
        },
      },
    },
    validating: {
      always: [
        { target: "finished", guard: "isGuessCorrect", actions: ["logWin"] },
        { target: "SuggestingNextOption", guard: "isNextOptionAvailable" },
        { target: "finished", actions: ["logLoss"] },
      ],
    },
    SuggestingNextOption: {
      entry: ["addNextHint"],
      always: "playing",
    },
    finished: {
      type: "final",
    },
  },
});
