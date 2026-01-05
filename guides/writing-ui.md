# Writing UI Components

UI components render game state and send events to the machine. They are **stateless** - all state comes from the machine context.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  App.tsx                                        │
│  ┌───────────────────────────────────────────┐  │
│  │  const [state, send] = useMachine(...)    │  │
│  │                                           │  │
│  │  <GameComponent                           │  │
│  │    context={state.context}                │  │
│  │    stateValue={state.value}               │  │
│  │    send={send}                            │  │
│  │  />                                       │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

The machine is created in the parent (`App.tsx`), and the game component receives:
- `context` - Current game state
- `stateValue` - Current machine state (e.g., 'playing', 'validating')
- `send` - Function to dispatch events

## Props Interface

```typescript
// src/ui/GameComponent.tsx
import type { GameContext, GameEvent } from '../machine.js';

export interface GameComponentProps {
  /** Current machine context */
  context: GameContext;

  /** Current machine state value */
  stateValue: string;

  /** Send events to machine */
  send: (event: GameEvent) => void;

  /** Optional custom styling */
  className?: string;
}
```

## Basic Component Structure

```typescript
export function GameComponent({
  context,
  stateValue,
  send,
  className = '',
}: GameComponentProps) {
  // 1. Destructure context
  const { score, currentInput, foundWords } = context;

  // 2. Derive state
  const isValidating = stateValue === 'validating';
  const canAct = !isValidating;

  // 3. Create handlers that send events
  const handleSubmit = useCallback(() => {
    if (canAct) {
      send({ type: 'SUBMIT' });
    }
  }, [canAct, send]);

  // 4. Render
  return (
    <div className={className}>
      <p>Score: {score}</p>
      <button onClick={handleSubmit} disabled={!canAct}>
        Submit
      </button>
    </div>
  );
}
```

## Event Handlers

Wrap `send` calls in `useCallback` for performance:

```typescript
const addLetter = useCallback((letter: string) => {
  if (canAct) {
    send({ type: 'ADD_LETTER', letter });
  }
}, [canAct, send]);

const deleteLetter = useCallback(() => {
  if (canAct) {
    send({ type: 'DELETE_LETTER' });
  }
}, [canAct, send]);

const submit = useCallback(() => {
  if (canAct && currentInput.length >= 4) {
    send({ type: 'SUBMIT' });
  }
}, [canAct, currentInput, send]);
```

## Keyboard Handling

Capture keyboard input with a hidden input element:

```typescript
export function GameComponent({ context, stateValue, send }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { letters, currentInput } = context;
  const canAct = stateValue !== 'validating';

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle typing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canAct) {
      e.target.value = '';
      return;
    }

    const value = e.target.value.toUpperCase();
    const lastChar = value.slice(-1);

    if (lastChar && letters.includes(lastChar)) {
      send({ type: 'ADD_LETTER', letter: lastChar });
    }
    e.target.value = ''; // Clear after processing
  }, [canAct, letters, send]);

  // Handle special keys
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!canAct) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      send({ type: 'SUBMIT' });
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      send({ type: 'DELETE_LETTER' });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      send({ type: 'CLEAR' });
    }
  }, [canAct, send]);

  return (
    <div onClick={() => inputRef.current?.focus()}>
      {/* Hidden input captures keyboard */}
      <input
        ref={inputRef}
        type="text"
        autoFocus
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
        aria-label="Type letters here"
        disabled={!canAct}
      />

      {/* Visible game UI */}
      <div>{currentInput || 'Start typing...'}</div>
    </div>
  );
}
```

## Displaying Feedback

Use context fields for user feedback:

```typescript
const { lastMessage, lastMessageType } = context;

const messageStyles = {
  info: 'bg-blue-500/20 text-blue-400',
  success: 'bg-green-500/20 text-green-400',
  error: 'bg-red-500/20 text-red-400',
  pangram: 'bg-amber-500/20 text-amber-400',
};

return (
  <>
    {lastMessage && (
      <div className={messageStyles[lastMessageType]}>
        {lastMessage}
      </div>
    )}
  </>
);
```

## Loading States

Check `stateValue` for async states:

```typescript
const isValidating = stateValue === 'validating';

return (
  <button disabled={isValidating}>
    {isValidating ? (
      <>
        <span className="animate-spin">*</span>
        Checking...
      </>
    ) : (
      'Submit'
    )}
  </button>
);
```

## Sub-Components

Extract reusable pieces:

```typescript
// Letter button
interface LetterButtonProps {
  letter: string;
  isCenter: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function LetterButton({ letter, isCenter, onClick, disabled }: LetterButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-16 h-16 text-2xl font-bold rounded-xl
        ${isCenter ? 'bg-amber-400' : 'bg-slate-200'}
        disabled:opacity-50
      `}
    >
      {letter}
    </button>
  );
}

// Word list
interface WordListProps {
  words: string[];
  letters: string[];
}

function WordList({ words, letters }: WordListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {words.map(word => (
        <span
          key={word}
          className={isPangram(word, letters) ? 'font-bold text-amber-400' : ''}
        >
          {word}
        </span>
      ))}
    </div>
  );
}
```

## Using Mechanics in UI

Import pure functions for display logic:

```typescript
import { isPangram, getWordStats } from '../mechanics.js';

function WordList({ words, letters }: WordListProps) {
  const stats = getWordStats(words, letters);

  return (
    <div>
      <h2>Found Words ({stats.totalWords})</h2>
      {stats.totalPangrams > 0 && (
        <span>{stats.totalPangrams} pangram(s)!</span>
      )}
      {words.map(word => (
        <span key={word} className={isPangram(word, letters) ? 'highlight' : ''}>
          {word}
        </span>
      ))}
    </div>
  );
}
```

## Export Structure

```typescript
// src/ui/index.ts
export { GameComponent } from './GameComponent.js';
export type { GameComponentProps } from './GameComponent.js';
```

## Wiring Up in App.tsx

```typescript
// apps/web/src/App.tsx
import { useMachine } from '@xstate/react';
import { gameMachine } from '@game-bench/game-name';
import { GameComponent } from '@game-bench/game-name/ui';

function App() {
  const [state, send] = useMachine(gameMachine, {
    input: { puzzleIndex: 0 }
  });

  return (
    <GameComponent
      context={state.context}
      stateValue={state.value as string}
      send={send}
    />
  );
}
```

## Guidelines

1. **Stateless components** - All state from machine context
2. **Props interface** - Type `context`, `stateValue`, `send`
3. **useCallback for handlers** - Optimize re-renders
4. **Check stateValue** - Disable UI during async states
5. **Import mechanics** - Use pure functions for display logic
6. **Hidden input for keyboard** - Capture typing anywhere
7. **Feedback from context** - Display `lastMessage` field

## Reference

See [`games/pangram/src/ui/PangramGame.tsx`](../games/pangram/src/ui/PangramGame.tsx) for a complete example.
