import { useState } from 'react';
import { Button, Typography, Alert } from 'antd';
import { TOTAL_ROUNDS } from '../App';

interface Props {
  onStart: (gameId: string, address: string) => void;
}

export function StartScreen({ onStart }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/game/start');
      if (!res.ok) throw new Error('Failed to load game');
      const { gameId, address } = await res.json() as { gameId: string; address: string };
      onStart(gameId, address);
    } catch {
      setError('Could not load a game right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        gap: 24,
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
        type="primary"
        size="large"
        block
        loading={loading}
        onClick={handleStart}
        style={{ maxWidth: 320, height: 56, fontSize: 20, fontWeight: 700 }}
      >
        {loading ? 'Loading…' : 'Start Game'}
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
