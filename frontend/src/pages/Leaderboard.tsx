import { useEffect, useState } from 'react';
import { Button, Input, Typography, Spin, Alert } from 'antd';
import { PlayerMapView } from './PlayerMapView';

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
  const [editSaved, setEditSaved] = useState(() => {
    const n = localStorage.getItem(NAME_KEY) ?? '';
    return n.length > 0 && n !== 'Anonymous';
  });
  const [selectedRow, setSelectedRow] = useState<ScoreRow | null>(null);

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
      const r = await fetch('/api/leaderboard');
      if (r.ok) setRows(await r.json());
    } finally {
      setEditLoading(false);
    }
  };

  if (selectedRow) {
    return (
      <PlayerMapView
        submissionId={selectedRow.submission_id}
        playerName={selectedRow.player_name}
        totalScore={selectedRow.score}
        onBack={() => setSelectedRow(null)}
      />
    );
  }

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

      {/* Name editor */}
      {mySubmissionId && (
        <div
          style={{
            background: editSaved ? 'rgba(255,255,255,0.05)' : 'rgba(22,119,255,0.18)',
            border: editSaved ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(22,119,255,0.5)',
            boxShadow: editSaved ? 'none' : '0 0 0 3px rgba(22,119,255,0.12)',
            borderRadius: 14,
            padding: '12px 14px',
            margin: '10px 0 4px',
            flexShrink: 0,
            transition: 'all 0.3s',
          }}
        >
          <div style={{ color: editSaved ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: 0.3 }}>
            {editSaved ? '✓ Your name is on the leaderboard' : '👆 Set your name on the leaderboard'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="Your name"
              value={editName}
              onChange={(e) => { setEditName(e.target.value); setEditSaved(false); }}
              onPressEnter={handleEditName}
              maxLength={50}
              autoFocus={!editSaved}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 10,
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                height: 40,
              }}
            />
            <Button
              type="primary"
              onClick={handleEditName}
              loading={editLoading}
              disabled={editSaved}
              style={{ borderRadius: 10, fontWeight: 700, flexShrink: 0, height: 40 }}
            >
              {editSaved ? '✓' : 'Save'}
            </Button>
          </div>
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
              onClick={() => setSelectedRow(row)}
              style={{
                background: isMe ? 'rgba(22,119,255,0.18)' : 'rgba(255,255,255,0.07)',
                border: isMe ? '1px solid rgba(22,119,255,0.4)' : '1px solid transparent',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
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
                  {formatDistance(row.distance_meters)} avg · {row.time_seconds}s · tap to view map
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
