import { useState } from 'react';
import { Button, Input } from 'antd';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import type { RoundResult } from '../App';
import { TOTAL_ROUNDS } from '../App';

interface Props {
  completedRounds: RoundResult[];
  onPlayAgain: () => void;
  onLeaderboard: () => void;
}

const NAME_KEY = 'manhattan_guessr_name';

const ROUND_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1'];

function scoreColor(score: number): string {
  const max = TOTAL_ROUNDS * 6000;
  const pct = score / max;
  if (pct >= 0.75) return '#f5a623';
  if (pct >= 0.5) return '#52c41a';
  if (pct >= 0.25) return '#fa8c16';
  return '#f5222d';
}

function scoreLabel(score: number): string {
  const max = TOTAL_ROUNDS * 6000;
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

export function FinalResults({ completedRounds, onPlayAgain, onLeaderboard }: Props) {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const totalScore = completedRounds.reduce((sum, r) => sum + r.score, 0);
  const totalTime = completedRounds.reduce((sum, r) => sum + r.timeSeconds, 0);
  const avgDistance = Math.round(completedRounds.reduce((sum, r) => sum + r.distanceMeters, 0) / completedRounds.length);

  const allLats = completedRounds.flatMap((r) => [r.guessLat, r.trueLat]);
  const allLngs = completedRounds.flatMap((r) => [r.guessLng, r.trueLng]);
  const PAD = 0.005;
  const bounds: LatLngBoundsExpression = [
    [Math.min(...allLats) - PAD, Math.min(...allLngs) - PAD],
    [Math.max(...allLats) + PAD, Math.max(...allLngs) + PAD],
  ];

  const handleSave = async () => {
    setSaving(true);
    const name = playerName.trim() || 'Anonymous';
    try {
      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: name,
          address: `${TOTAL_ROUNDS}-round series`,
          distanceMeters: avgDistance,
          timeSeconds: totalTime,
          score: totalScore,
        }),
      });
      localStorage.setItem(NAME_KEY, name);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

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
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
          {scoreLabel(totalScore)}
        </div>
        <div style={{ fontSize: 60, fontWeight: 900, color: scoreColor(totalScore), lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>
          {totalScore.toLocaleString()}
        </div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
          <Stat label="Avg distance" value={formatDistance(avgDistance)} />
          <Stat label="Total time" value={`${totalTime}s`} />
        </div>
        {/* Per-round breakdown */}
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
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onPressEnter={handleSave}
            maxLength={50}
            disabled={saved}
            bordered={false}
            style={{ flex: 1, fontWeight: saved ? 600 : 400, padding: 0 }}
          />
          <Button
            type={saved ? 'default' : 'primary'}
            onClick={handleSave}
            loading={saving}
            disabled={saved}
            style={{ borderRadius: 10, fontWeight: 600, flexShrink: 0 }}
          >
            {saved ? '✓ Saved' : 'Save score'}
          </Button>
        </div>
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
            type="primary"
            size="large"
            onClick={onPlayAgain}
            style={{ flex: 2, height: 52, fontSize: 16, fontWeight: 700, borderRadius: 14, boxShadow: '0 6px 20px rgba(22,119,255,0.45)' }}
          >
            Play Again
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
