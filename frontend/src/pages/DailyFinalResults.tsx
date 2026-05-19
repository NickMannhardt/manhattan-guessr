import { useEffect, useRef, useState } from 'react';
import { Button, Input, Spin } from 'antd';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import type { RoundResult } from '../App';
import { TOTAL_ROUNDS } from '../App';

interface Props {
  completedRounds: RoundResult[];
  dailySessionId: string;
  onLeaderboard: () => void;
  onPlayPractice: () => void;
}

const NAME_KEY = 'manhattan_guessr_name';
const DAILY_KEY_PREFIX = 'manhattan_guessr_daily_';

function todayKey(): string {
  return DAILY_KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

const ROUND_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1'];

function scoreColor(score: number): string {
  const max = TOTAL_ROUNDS * 5000;
  const pct = score / max;
  if (pct >= 0.75) return '#f5a623';
  if (pct >= 0.5) return '#52c41a';
  if (pct >= 0.25) return '#fa8c16';
  return '#f5222d';
}

function scoreLabel(score: number): string {
  const max = TOTAL_ROUNDS * 5000;
  const pct = score / max;
  if (pct >= 0.75) return 'Manhattan expert!';
  if (pct >= 0.5) return 'Nice work!';
  if (pct >= 0.25) return 'Not bad!';
  return 'Keep exploring!';
}

function formatDistance(meters: number): string {
  const feet = Math.round(meters * 3.281);
  if (feet < 5280) return `${feet.toLocaleString()} ft`;
  return `${(feet / 5280).toFixed(2)} mi`;
}

export function DailyFinalResults({ completedRounds, dailySessionId, onLeaderboard, onPlayPractice }: Props) {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const savedRef = useRef(false);

  const totalScore = completedRounds.reduce((sum, r) => sum + r.score, 0);
  const totalTime = completedRounds.reduce((sum, r) => sum + r.timeSeconds, 0);
  const avgDistance = Math.round(completedRounds.reduce((sum, r) => sum + r.distanceMeters, 0) / completedRounds.length);

  // Auto-save once on mount
  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    // Check if already submitted today (e.g. page reload)
    const raw = localStorage.getItem(todayKey());
    if (raw) {
      try {
        const existing = JSON.parse(raw) as { submissionId: string; score: number };
        setSubmissionId(existing.submissionId);
        return;
      } catch {
        // proceed to submit
      }
    }

    setSaving(true);
    const name = (localStorage.getItem(NAME_KEY) ?? '').trim() || 'Anonymous';
    fetch('/api/daily/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dailySessionId,
        playerName: name,
        totalScore,
        avgDistanceMeters: avgDistance,
        totalTimeSeconds: totalTime,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Submit failed');
        return r.json() as Promise<{ submissionId: string }>;
      })
      .then(({ submissionId: sid }) => {
        setSubmissionId(sid);
        localStorage.setItem(todayKey(), JSON.stringify({ submissionId: sid, score: totalScore }));
      })
      .catch(() => setSubmitError(true))
      .finally(() => setSaving(false));
  }, [dailySessionId, totalScore, avgDistance, totalTime]);

  const handleNameSave = async () => {
    if (!submissionId) return;
    const name = playerName.trim() || 'Anonymous';
    setNameLoading(true);
    setNameSaved(false);
    try {
      await fetch(`/api/daily/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name }),
      });
      localStorage.setItem(NAME_KEY, name);
      setNameSaved(true);
    } finally {
      setNameLoading(false);
    }
  };

  const allLats = completedRounds.flatMap((r) => [r.guessLat, r.trueLat]);
  const allLngs = completedRounds.flatMap((r) => [r.guessLng, r.trueLng]);
  const PAD = 0.005;
  const bounds: LatLngBoundsExpression = [
    [Math.min(...allLats) - PAD, Math.min(...allLngs) - PAD],
    [Math.max(...allLats) + PAD, Math.max(...allLngs) + PAD],
  ];

  return (
    <div style={{ height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <MapContainer bounds={bounds} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c', 'd']}
        />
        {completedRounds.map((r, i) => {
          const color = ROUND_COLORS[i % ROUND_COLORS.length];
          return (
            <span key={i}>
              <CircleMarker
                center={[r.guessLat, r.guessLng]}
                radius={7}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -8]}>Round {i + 1} — your guess</Tooltip>
              </CircleMarker>
              <CircleMarker
                center={[r.trueLat, r.trueLng]}
                radius={7}
                pathOptions={{ color, fillColor: 'white', fillOpacity: 0.9, weight: 2.5 }}
              >
                <Tooltip direction="top" offset={[0, -8]}>{r.address}</Tooltip>
              </CircleMarker>
              <Polyline
                positions={[[r.guessLat, r.guessLng], [r.trueLat, r.trueLng]]}
                pathOptions={{ color, opacity: 0.5, dashArray: '5 4', weight: 1.5 }}
              />
            </span>
          );
        })}
      </MapContainer>

      {/* Score card */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 1000,
          background: 'rgba(10,14,23,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 20,
          padding: '16px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
            {scoreLabel(totalScore)}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
            Daily Challenge
          </div>
        </div>
        <div style={{ fontSize: 60, fontWeight: 900, color: scoreColor(totalScore), lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>
          {totalScore.toLocaleString()}
        </div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
          <Stat label="Avg distance" value={formatDistance(avgDistance)} />
          <Stat label="Total time" value={`${totalTime}s`} />
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {completedRounds.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ROUND_COLORS[i % ROUND_COLORS.length], flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.address}
                </span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8 }}>
                {r.score.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {saving ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
            <Spin size="small" />
          </div>
        ) : submitError ? (
          <div style={{ color: '#ff4d4f', fontSize: 13, textAlign: 'center' }}>
            Score could not be saved. Your result was still recorded locally.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 8,
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              borderRadius: 14,
              padding: '8px 8px 8px 14px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              alignItems: 'center',
            }}
          >
            <Input
              placeholder="Your name on leaderboard"
              value={playerName}
              onChange={(e) => { setPlayerName(e.target.value); setNameSaved(false); }}
              onPressEnter={handleNameSave}
              maxLength={50}
              disabled={!submissionId}
              bordered={false}
              style={{ flex: 1, fontWeight: nameSaved ? 600 : 400, padding: 0 }}
            />
            <Button
              type={nameSaved ? 'default' : 'primary'}
              onClick={handleNameSave}
              loading={nameLoading}
              disabled={!submissionId || nameSaved}
              style={{ borderRadius: 10, fontWeight: 600, flexShrink: 0 }}
            >
              {nameSaved ? '✓ Saved' : 'Update Name'}
            </Button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            size="large"
            onClick={onLeaderboard}
            style={{
              flex: 1, height: 52, fontWeight: 600, borderRadius: 14,
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            Leaderboard
          </Button>
          <Button
            size="large"
            onClick={onPlayPractice}
            style={{
              flex: 2, height: 52, fontSize: 15, fontWeight: 600, borderRadius: 14,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: 'white',
            }}
          >
            Practice Mode
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{value}</div>
    </div>
  );
}
