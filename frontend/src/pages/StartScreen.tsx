import { useEffect, useState } from 'react';
import { Button, Typography, Alert } from 'antd';
import { TOTAL_ROUNDS } from '../App';

const DAILY_KEY_PREFIX = 'manhattan_guessr_daily_';

function todayKey(): string {
  return DAILY_KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

interface DailyRecord {
  submissionId: string;
  score: number;
}

interface LeaderboardRow {
  submission_id: string;
  score: number;
}

interface Props {
  onStartPractice: (gameId: string, address: string) => void;
  onStartDaily: (dailySessionId: string, addresses: string[]) => void;
  onLeaderboard: () => void;
}

export function StartScreen({ onStartPractice, onStartDaily, onLeaderboard }: Props) {
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState<DailyRecord | null>(null);
  const [myRank, setMyRank] = useState<{ rank: number; total: number } | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(todayKey());
    if (!raw) return;
    try {
      const record = JSON.parse(raw) as DailyRecord;
      setAlreadyPlayed(record);
      // Fetch leaderboard to find rank
      fetch('/api/leaderboard')
        .then((r) => r.json() as Promise<LeaderboardRow[]>)
        .then((rows) => {
          const idx = rows.findIndex((r) => r.submission_id === record.submissionId);
          if (idx !== -1) {
            setMyRank({ rank: idx + 1, total: rows.length });
          }
        })
        .catch(() => {});
    } catch {
      // ignore corrupt entry
    }
  }, []);

  const handleStartPractice = async () => {
    setPracticeLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/game/start');
      if (!res.ok) throw new Error('Failed to load game');
      const { gameId, address } = await res.json() as { gameId: string; address: string };
      onStartPractice(gameId, address);
    } catch {
      setError('Could not load a game right now. Please try again.');
    } finally {
      setPracticeLoading(false);
    }
  };

  const handleStartDaily = async () => {
    setDailyLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/daily/start');
      if (!res.ok) throw new Error('Failed to load daily challenge');
      const { dailySessionId, addresses } = await res.json() as { dailySessionId: string; addresses: string[] };
      onStartDaily(dailySessionId, addresses);
    } catch {
      setError("Could not load today's challenge. Please try again.");
    } finally {
      setDailyLoading(false);
    }
  };

  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(160deg, #001529 0%, #003a70 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        gap: 16,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44, lineHeight: 1 }}>🗽</div>
        <Typography.Title
          level={1}
          style={{ color: 'white', margin: '8px 0 4px', fontSize: 30, fontWeight: 900 }}
        >
          Manhattan Guessr
        </Typography.Title>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16 }}>
          You'll get <strong style={{ color: 'white' }}>{TOTAL_ROUNDS} addresses</strong> from across Manhattan.
          <br />
          Drag the map so the marker lands on each one.
        </Typography.Text>
      </div>

      {/* How it works */}
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { step: '1', text: `You get ${TOTAL_ROUNDS} real Manhattan addresses, one at a time` },
          { step: '2', text: 'Drag the map to place your guess, then tap Lock In' },
          { step: '3', text: 'See how close you were before the next round' },
          { step: '4', text: 'After all 5, your total score is revealed on a single map' },
        ].map(({ step, text }) => (
          <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              color: 'white', fontWeight: 700, fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
            }}>
              {step}
            </div>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: '1.4' }}>
              {text}
            </Typography.Text>
          </div>
        ))}
      </div>

      {error && <Alert type="error" message={error} showIcon style={{ width: '100%', maxWidth: 320 }} />}

      {/* Daily challenge card */}
      <div
        style={{
          width: '100%',
          maxWidth: 320,
          background: alreadyPlayed
            ? 'rgba(255,255,255,0.06)'
            : 'linear-gradient(135deg, rgba(22,119,255,0.25) 0%, rgba(114,46,209,0.25) 100%)',
          border: alreadyPlayed ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(22,119,255,0.4)',
          borderRadius: 16,
          padding: '16px 18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
              Daily Challenge
            </div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{todayLabel}</div>
          </div>
          <div style={{ fontSize: 24 }}>📅</div>
        </div>

        {alreadyPlayed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <div style={{ color: '#faad14', fontWeight: 900, fontSize: 36, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {alreadyPlayed.score.toLocaleString()}
                <span style={{ fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>pts</span>
              </div>
              {myRank && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: '3px 10px',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  #{myRank.rank} of {myRank.total}
                </div>
              )}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 10 }}>
              You've played today's challenge
            </div>
            <Button
              type="primary"
              block
              onClick={onLeaderboard}
              style={{ height: 44, fontWeight: 700, borderRadius: 10, fontSize: 15 }}
            >
              View Leaderboard
            </Button>
          </>
        ) : (
          <>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 12 }}>
              Everyone plays the same {TOTAL_ROUNDS} addresses today — scores go on the leaderboard.
            </div>
            <Button
              type="primary"
              block
              loading={dailyLoading}
              onClick={handleStartDaily}
              style={{ height: 44, fontWeight: 700, borderRadius: 10, fontSize: 15 }}
            >
              Play Daily Challenge
            </Button>
          </>
        )}
      </div>

      <Button
        size="large"
        block
        loading={practiceLoading}
        onClick={handleStartPractice}
        style={{
          maxWidth: 320, height: 52, fontSize: 16, fontWeight: 600,
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'white',
          borderRadius: 14,
        }}
      >
        {practiceLoading ? 'Loading…' : 'Practice Mode'}
      </Button>
    </div>
  );
}

