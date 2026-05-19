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

interface Props {
  onStartPractice: (gameId: string, address: string) => void;
  onStartDaily: (dailySessionId: string, addresses: string[]) => void;
}

export function StartScreen({ onStartPractice, onStartDaily }: Props) {
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState<DailyRecord | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(todayKey());
    if (raw) {
      try {
        setAlreadyPlayed(JSON.parse(raw) as DailyRecord);
      } catch {
        // ignore corrupt entry
      }
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
      setError('Could not load today\'s challenge. Please try again.');
    } finally {
      setDailyLoading(false);
    }
  };

  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div
      style={{
        height: '100dvh',
        background: 'linear-gradient(160deg, #001529 0%, #003a70 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        gap: 20,
        overflowY: 'auto',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>🗽</div>
        <Typography.Title
          level={1}
          style={{ color: 'white', margin: '12px 0 4px', fontSize: 36, fontWeight: 900 }}
        >
          Manhattan Guessr
        </Typography.Title>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16 }}>
          You'll get <strong style={{ color: 'white' }}>{TOTAL_ROUNDS} addresses</strong> from across Manhattan.
          <br />
          Drag the map so the marker lands on each one.
        </Typography.Text>
      </div>

      {/* Daily challenge card */}
      <div
        style={{
          width: '100%',
          maxWidth: 320,
          background: alreadyPlayed
            ? 'rgba(255,255,255,0.06)'
            : 'linear-gradient(135deg, rgba(22,119,255,0.25) 0%, rgba(114,46,209,0.25) 100%)',
          border: '1px solid rgba(255,255,255,0.15)',
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
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 4 }}>
              You played today
            </div>
            <div style={{ color: '#faad14', fontWeight: 900, fontSize: 28, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {alreadyPlayed.score.toLocaleString()} pts
            </div>
          </div>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            Everyone plays the same {TOTAL_ROUNDS} addresses today — scores go on the leaderboard.
          </div>
        )}

        <Button
          type="primary"
          block
          loading={dailyLoading}
          onClick={handleStartDaily}
          disabled={!!alreadyPlayed}
          style={{ marginTop: 12, height: 44, fontWeight: 700, borderRadius: 10, fontSize: 15 }}
        >
          {alreadyPlayed ? 'Already Played Today' : 'Play Daily Challenge'}
        </Button>
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

      {/* Scoring */}
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '14px 18px',
          width: '100%',
          maxWidth: 320,
        }}
      >
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
          Per-round scoring (max 5,000)
        </div>
        <ScoringRow label="Spot on (0m, 0s)" value="5,000" color="#faad14" />
        <ScoringRow label="2 blocks off, 20s" value="~3,200" color="#52c41a" />
        <ScoringRow label="Half mile off, 60s" value="~50" color="#fa8c16" />
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
          Precision matters — distance decays exponentially
        </div>
      </div>

      {error && <Alert type="error" message={error} showIcon style={{ width: '100%', maxWidth: 320 }} />}

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

function ScoringRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <Typography.Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{label}</Typography.Text>
      <Typography.Text style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>{value}</Typography.Text>
    </div>
  );
}
