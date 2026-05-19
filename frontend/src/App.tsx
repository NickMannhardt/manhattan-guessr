import { useState } from 'react';
import { StartScreen } from './pages/StartScreen';
import { GamePage } from './pages/Game';
import { RoundResults } from './pages/RoundResults';
import { FinalResults } from './pages/FinalResults';
import { LeaderboardPage } from './pages/Leaderboard';

export interface GameResult {
  score: number;
  distanceMeters: number;
  trueLat: number;
  trueLng: number;
  address: string;
}

export interface RoundResult extends GameResult {
  guessLat: number;
  guessLng: number;
  timeSeconds: number;
}

export const TOTAL_ROUNDS = 5;

type Phase =
  | { name: 'start' }
  | {
      name: 'round';
      roundNumber: number;
      gameId: string;
      address: string;
      startedAt: number;
      completedRounds: RoundResult[];
    }
  | {
      name: 'between-rounds';
      roundNumber: number;
      latest: RoundResult;
      completedRounds: RoundResult[];
      nextGame: { gameId: string; address: string } | null;
    }
  | { name: 'final'; completedRounds: RoundResult[] }
  | { name: 'leaderboard' };

async function fetchGame(): Promise<{ gameId: string; address: string }> {
  const res = await fetch('/api/game/start');
  if (!res.ok) throw new Error('Failed to load game');
  return res.json();
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: 'start' });

  const startSeries = (gameId: string, address: string) => {
    setPhase({ name: 'round', roundNumber: 1, gameId, address, startedAt: Date.now(), completedRounds: [] });
  };

  const handlePlayAgain = async () => {
    setPhase({ name: 'start' });
    try {
      const { gameId, address } = await fetchGame();
      startSeries(gameId, address);
    } catch {
      setPhase({ name: 'start' });
    }
  };

  const handleRoundResult = async (
    result: GameResult,
    guessLat: number,
    guessLng: number,
    timeSeconds: number,
    completedRounds: RoundResult[],
    roundNumber: number,
  ) => {
    const latest: RoundResult = { ...result, guessLat, guessLng, timeSeconds };
    const allRounds = [...completedRounds, latest];

    if (roundNumber >= TOTAL_ROUNDS) {
      setPhase({ name: 'final', completedRounds: allRounds });
      return;
    }

    // Show between-rounds screen immediately, prefetch next game in background
    setPhase({ name: 'between-rounds', roundNumber, latest, completedRounds: allRounds, nextGame: null });
    fetchGame()
      .then((next) =>
        setPhase((prev) =>
          prev.name === 'between-rounds' ? { ...prev, nextGame: next } : prev
        )
      )
      .catch(() => {
        // next game fetch will be retried when user clicks Next
      });
  };

  const handleNextRound = async (completedRounds: RoundResult[], nextGame: { gameId: string; address: string } | null) => {
    const game = nextGame ?? (await fetchGame());
    setPhase({
      name: 'round',
      roundNumber: completedRounds.length + 1,
      gameId: game.gameId,
      address: game.address,
      startedAt: Date.now(),
      completedRounds,
    });
  };

  if (phase.name === 'start') {
    return <StartScreen onStart={startSeries} />;
  }

  if (phase.name === 'round') {
    return (
      <GamePage
        gameId={phase.gameId}
        address={phase.address}
        startedAt={phase.startedAt}
        roundNumber={phase.roundNumber}
        completedRounds={phase.completedRounds}
        onResult={(result, guessLat, guessLng, timeSeconds) =>
          handleRoundResult(result, guessLat, guessLng, timeSeconds, phase.completedRounds, phase.roundNumber)
        }
      />
    );
  }

  if (phase.name === 'between-rounds') {
    return (
      <RoundResults
        roundNumber={phase.roundNumber}
        latest={phase.latest}
        completedRounds={phase.completedRounds}
        nextGame={phase.nextGame}
        onNext={(nextGame) => handleNextRound(phase.completedRounds, nextGame)}
      />
    );
  }

  if (phase.name === 'final') {
    return (
      <FinalResults
        completedRounds={phase.completedRounds}
        onPlayAgain={handlePlayAgain}
        onLeaderboard={() => setPhase({ name: 'leaderboard' })}
      />
    );
  }

  return <LeaderboardPage onBack={() => setPhase({ name: 'start' })} />;
}
