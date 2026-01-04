import { useMachine } from '@xstate/react';
import { pangramMachine } from '@game-bench/pangram';
import { PangramGame } from '@game-bench/pangram/ui';

function App() {
  const [state, send] = useMachine(pangramMachine, {
    input: { puzzleIndex: 0 }
  });

  return (
    <PangramGame
      context={state.context}
      stateValue={state.value as string}
      send={send}
    />
  );
}

export default App;
