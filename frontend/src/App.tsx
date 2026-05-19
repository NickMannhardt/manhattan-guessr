import { useState } from 'react';
import { StartScreen } from './pages/StartScreen';
import { GamePage } from './pages/Game';
import { RoundResults } from './pages/RoundResults';
import { FinalResults } from './pages/FinalResults';
import { DailyFinalResults } from './pages/DailyFinalResults';
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
  // Practice mode
  | {
      name: 'round';
      gameId: string;
      address: string;
      startedAt: number;
      roundNumber: number;
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
  // Daily mode
  | {
      name: 'daily-round';
      dailySessionId: string;
      roundIndex: number;
      addresses: string[];
      startedAt: number;
      completedRounds: RoundResult[];
    }
  | {
      name: 'daily-between';
      roundIndex: number;
      latest: RoundResult;
      completedRounds: RoundResult[];
      dailySessionId: string;
      addresses: string[];
    }
  | { name: 'daily-final'; completedRounds: RoundResult[]; dailySessionId: string }
  | { name: 'leaderboard' };

async function fetchPracticeGame(): Promise<{ gameId: string; address: string }> {
  const res = await fetch('/api/game/start');
  if (!res.ok) throw new Error('Failed to load game');
  return res.json();
}

async function submitPracticeRound(
  gameId: string,
  guessedLat: number,
  guessedLng: number,
  timeSeconds: number,
): Promise<GameResult> {
  const res = await fetch('/api/game/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, guessedLat, guessedLng, timeSeconds }),
  });
  if (!res.ok) throw new Error('Submit failed');
  return res.json();
}

async function submitDailyRound(
  dailySessionId: string,
  roundIndex: number,
  guessedLat: number,
  guessedLng: number,
  timeSeconds: number,
): Promise<GameResult> {
  const res = await fetch('/api/daily/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailySessionId, roundIndex, guessedLat, guessedLng, timeSeconds }),
  });
  if (!res.ok) throw new Error('Submit failed');
  return res.json();
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: 'start' });

  // --- Practice mode ---

  const startPracticeSeries = (gameId: string, address: string) => {
    setPhase({ name: 'round', roundNumber: 1, gameId, address, startedAt: Date.now(), completedRounds: [] });
  };

  const handlePlayAgain = async () => {
    setPhase({ name: 'start' });
    try {
      const { gameId, address } = await fetchPracticeGame();
      startPracticeSeries(gameId, address);
    } catch {
      setPhase({ name: 'start' });
    }
  };

  const handlePracticeRoundResult = async (
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

    setPhase({ name: 'between-rounds', roundNumber, latest, completedRounds: allRounds, nextGame: null });
    fetchPracticeGame()
      .then((next) =>
        setPhase((prev) =>
          prev.name === 'between-rounds' ? { ...prev, nextGame: next } : prev
        )
      )
      .catch(() => {});
  };

  const handlePracticeNext = async (nextGame: { gameId: string; address: string } | null, completedRounds: RoundResult[]) => {
    const game = nextGame ?? (await fetchPracticeGame());
    setPhase({
      name: 'round',
      roundNumber: completedRounds.length + 1,
      gameId: game.gameId,
      address: game.address,
      startedAt: Date.now(),
      completedRounds,
    });
  };

  // --- Daily mode ---

  const startDailySeries = (dailySessionId: string, addresses: string[]) => {
    setPhase({ name: 'daily-round', dailySessionId, roundIndex: 0, addresses, startedAt: Date.now(), completedRounds: [] });
  };

  const handleDailyRoundResult = (
    result: GameResult,
    guessLat: number,
    guessLng: number,
    timeSeconds: number,
    completedRounds: RoundResult[],
    roundIndex: number,
    dailySessionId: string,
    addresses: string[],
  ) => {
    const latest: RoundResult = { ...result, guessLat, guessLng, timeSeconds };
    const allRounds = [...completedRounds, latest];

    if (roundIndex >= TOTAL_ROUNDS - 1) {
      setPhase({ name: 'daily-final', completedRounds: allRounds, dailySessionId });
      return;
    }

    setPhase({ name: 'daily-between', roundIndex, latest, completedRounds: allRounds, dailySessionId, addresses });
  };

  const handleDailyNext = (roundIndex: number, completedRounds: RoundResult[], dailySessionId: string, addresses: string[]) => {
    setPhase({
      name: 'daily-round',
      dailySessionId,
      roundIndex: roundIndex + 1,
      addresses,
      startedAt: Date.now(),
      completedRounds,
    });
  };

  // --- Render ---

  if (phase.name === 'start') {
    return (
      <StartScreen
        onStartPractice={startPracticeSeries}
        onStartDaily={startDailySeries}
        onLeaderboard={() => setPhase({ name: 'leaderboard' })}
      />
    );
  }

  if (phase.name === 'round') {
    return (
      <GamePage
        address={phase.address}
        startedAt={phase.startedAt}
        roundNumber={phase.roundNumber}
        completedRounds={phase.completedRounds}
        submitFn={(lat, lng, t) => submitPracticeRound(phase.gameId, lat, lng, t)}
        onResult={(result, guessLat, guessLng, timeSeconds) =>
          handlePracticeRoundResult(result, guessLat, guessLng, timeSeconds, phase.completedRounds, phase.roundNumber)
        }
      />
    );
  }

  if (phase.name === 'between-rounds') {
    const { roundNumber, completedRounds, nextGame } = phase;
    return (
      <RoundResults
        roundNumber={roundNumber}
        latest={phase.latest}
        completedRounds={completedRounds}
        onNext={() => handlePracticeNext(nextGame, completedRounds)}
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

  if (phase.name === 'daily-round') {
    const { dailySessionId, roundIndex, addresses, completedRounds } = phase;
    return (
      <GamePage
        address={addresses[roundIndex]}
        startedAt={phase.startedAt}
        roundNumber={roundIndex + 1}
        completedRounds={completedRounds}
        submitFn={(lat, lng, t) => submitDailyRound(dailySessionId, roundIndex, lat, lng, t)}
        onResult={(result, guessLat, guessLng, timeSeconds) =>
          handleDailyRoundResult(result, guessLat, guessLng, timeSeconds, completedRounds, roundIndex, dailySessionId, addresses)
        }
      />
    );
  }

  if (phase.name === 'daily-between') {
    const { roundIndex, completedRounds, dailySessionId, addresses } = phase;
    return (
      <RoundResults
        roundNumber={roundIndex + 1}
        latest={phase.latest}
        completedRounds={completedRounds}
        onNext={() => handleDailyNext(roundIndex, completedRounds, dailySessionId, addresses)}
      />
    );
  }

  if (phase.name === 'daily-final') {
    return (
      <DailyFinalResults
        completedRounds={phase.completedRounds}
        dailySessionId={phase.dailySessionId}
        onLeaderboard={() => setPhase({ name: 'leaderboard' })}
        onPlayPractice={handlePlayAgain}
      />
    );
  }

  return <LeaderboardPage onBack={() => setPhase({ name: 'start' })} />;
}
