import { useEffect, useState } from 'react';
import { Button, Input, Typography, Spin, Alert } from 'antd';

interface ScoreRow {
  player_name: string;
  score: number;
  distance_meters: number;
  time_seconds: number;
  submission_id: string;
  created_at: string;
}

interface Props {
  onBack: () => void;
}

const DAILY_KEY_PREFIX = 'manhattan_guessr_daily_';
const NAME_KEY = 'manhattan_guessr_name';

function todayKey(): string {
  return DAILY_KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

function medal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}.`;
}

function scoreColor(score: number): string {
  if (score >= 20000) return '#faad14';
  if (score >= 12000) return '#52c41a';
  if (score >= 6000) return '#fa8c16';
  return '#f5222d';
}

function formatDistance(meters: number): string {
  const feet = Math.round(Number(meters) * 3.281);
  if (feet < 5280) return `${feet.toLocaleString()} ft`;
  return `${(feet / 5280).toFixed(2)} mi`;
}

export function LeaderboardPage({ onBack }: Props) {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mySubmissionId, setMySubmissionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editSaved, setEditSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(todayKey());
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { submissionId: string };
        setMySubmissionId(parsed.submissionId);
      } catch {
        // ignore
      }
    }
    setEditName(localStorage.getItem(NAME_KEY) ?? '');
  }, []);

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

  const handleEditName = async () => {
    if (!mySubmissionId) return;
    const name = editName.trim() || 'Anonymous';
    setEditLoading(true);
    setEditSaved(false);
    try {
      await fetch(`/api/daily/${mySubmissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name }),
      });
      localStorage.setItem(NAME_KEY, name);
      setEditSaved(true);
      // Refresh leaderboard
      const r = await fetch('/api/leaderboard');
      if (r.ok) setRows(await r.json());
    } finally {
      setEditLoading(false);
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
        padding: '24px 16px 16px',
        overflow: 'hidden',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 4, flexShrink: 0 }}>
        <Typography.Title level={2} style={{ color: 'white', margin: 0 }}>
          🏆 Daily Leaderboard
        </Typography.Title>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>{todayLabel}</div>
      </div>

      {/* Name editor — only visible if you played today */}
      {mySubmissionId && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: '8px 8px 8px 14px',
            margin: '12px 0',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <Input
            placeholder="Your name"
            value={editName}
            onChange={(e) => { setEditName(e.target.value); setEditSaved(false); }}
            onPressEnter={handleEditName}
            maxLength={50}
            bordered={false}
            style={{ flex: 1, color: 'white', padding: 0, background: 'transparent' }}
          />
          <Button
            type={editSaved ? 'default' : 'primary'}
            size="small"
            onClick={handleEditName}
            loading={editLoading}
            disabled={editSaved}
            style={{ borderRadius: 8, fontWeight: 600, flexShrink: 0 }}
          >
            {editSaved ? '✓ Saved' : 'Update'}
          </Button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Spin size="large" />
          </div>
        )}
        {error && <Alert type="error" message={error} showIcon />}
        {!loading && !error && rows.length === 0 && (
          <Typography.Text style={{ color: 'rgba(255,255,255,0.5)', display: 'block', textAlign: 'center', marginTop: 40 }}>
            No scores yet today. Be the first!
          </Typography.Text>
        )}
        {rows.map((row, i) => {
          const isMe = row.submission_id === mySubmissionId;
          return (
            <div
              key={row.submission_id || i}
              style={{
                background: isMe ? 'rgba(22,119,255,0.18)' : 'rgba(255,255,255,0.07)',
                border: isMe ? '1px solid rgba(22,119,255,0.4)' : '1px solid transparent',
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
                <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                  {row.player_name}{isMe && <span style={{ color: 'rgba(22,119,255,0.8)', fontSize: 12, fontWeight: 400, marginLeft: 6 }}>you</span>}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                  {formatDistance(row.distance_meters)} avg · {row.time_seconds}s
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
          );
        })}
      </div>

      <div style={{ paddingTop: 12, flexShrink: 0 }}>
        <Button size="large" block onClick={onBack} style={{ height: 52, fontWeight: 600 }}>
          ← Back
        </Button>
      </div>
    </div>
  );
}
