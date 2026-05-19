import { useEffect, useState } from 'react';
import { Button, Typography, Spin, Alert } from 'antd';

interface ScoreRow {
  player_name: string;
  address: string;
  distance_meters: number;
  time_seconds: number;
  score: number;
  created_at: string;
}

interface Props {
  onBack: () => void;
}

function medal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}.`;
}

function scoreColor(score: number): string {
  if (score >= 8000) return '#faad14';
  if (score >= 5000) return '#52c41a';
  if (score >= 2000) return '#fa8c16';
  return '#f5222d';
}

export function LeaderboardPage({ onBack }: Props) {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json() as Promise<ScoreRow[]>;
      })
      .then(setRows)
      .catch(() => setError('Could not load leaderboard.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        height: '100dvh',
        background: 'linear-gradient(160deg, #001529 0%, #003a70 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px 16px',
        overflow: 'hidden',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24, flexShrink: 0 }}>
        <Typography.Title level={2} style={{ color: 'white', margin: 0 }}>
          🏆 Top Scores
        </Typography.Title>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Spin size="large" />
          </div>
        )}
        {error && <Alert type="error" message={error} showIcon />}
        {!loading && !error && rows.length === 0 && (
          <Typography.Text style={{ color: 'rgba(255,255,255,0.5)', display: 'block', textAlign: 'center', marginTop: 40 }}>
            No scores yet. Be the first!
          </Typography.Text>
        )}
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 22, width: 32, textAlign: 'center', flexShrink: 0 }}>
              {medal(i + 1)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{row.player_name}</div>
              <div
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.address}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                {Math.round(row.distance_meters)}m off · {row.time_seconds}s
              </div>
            </div>
            <div
              style={{
                color: scoreColor(row.score),
                fontWeight: 900,
                fontSize: 22,
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {row.score.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div style={{ paddingTop: 12, flexShrink: 0 }}>
        <Button size="large" block onClick={onBack} style={{ height: 52, fontWeight: 600 }}>
          ← Back
        </Button>
      </div>
    </div>
  );
}
