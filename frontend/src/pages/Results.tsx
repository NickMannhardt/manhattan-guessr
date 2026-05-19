import { useState } from 'react';
import { Button, Input } from 'antd';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import type { GameResult } from '../App';

interface Props {
  result: GameResult;
  guessLat: number;
  guessLng: number;
  timeSeconds: number;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
}

const NAME_KEY = 'manhattan_guessr_name';

function scoreColor(score: number): string {
  if (score >= 4000) return '#f5a623';
  if (score >= 2500) return '#52c41a';
  if (score >= 1000) return '#fa8c16';
  return '#f5222d';
}

function scoreLabel(score: number): string {
  if (score >= 4000) return 'Incredible!';
  if (score >= 2500) return 'Nice work!';
  if (score >= 1000) return 'Not bad!';
  return 'Keep practicing!';
}

function formatDistance(meters: number): string {
  const feet = Math.round(meters * 3.281);
  if (feet < 5280) return `${feet.toLocaleString()} ft`;
  return `${(feet / 5280).toFixed(2)} mi`;
}

export function ResultsPage({ result, guessLat, guessLng, timeSeconds, onPlayAgain, onLeaderboard }: Props) {
  const { score, distanceMeters, trueLat, trueLng, address } = result;
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const PAD = 0.004;
  const bounds: LatLngBoundsExpression = [
    [Math.min(guessLat, trueLat) - PAD, Math.min(guessLng, trueLng) - PAD],
    [Math.max(guessLat, trueLat) + PAD, Math.max(guessLng, trueLng) + PAD],
  ];

  const handleSave = async () => {
    setSaving(true);
    const name = playerName.trim() || 'Anonymous';
    try {
      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name, address, distanceMeters, timeSeconds, score }),
      });
      localStorage.setItem(NAME_KEY, name);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ height: '100dvh', position: 'relative', overflow: 'hidden' }}>

      <MapContainer
        bounds={bounds}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c', 'd']}
        />
        <CircleMarker
          center={[guessLat, guessLng]}
          radius={10}
          pathOptions={{ color: '#1677ff', fillColor: '#1677ff', fillOpacity: 0.9, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>Your guess</Tooltip>
        </CircleMarker>
        <CircleMarker
          center={[trueLat, trueLng]}
          radius={10}
          pathOptions={{ color: '#f5222d', fillColor: '#f5222d', fillOpacity: 0.9, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>{address}</Tooltip>
        </CircleMarker>
        <Polyline
          positions={[[guessLat, guessLng], [trueLat, trueLng]]}
          pathOptions={{ color: 'rgba(0,0,0,0.35)', dashArray: '6 5', weight: 2 }}
        />
      </MapContainer>

      {/* Score card */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 1000,
          background: 'rgba(10, 14, 23, 0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 20,
          padding: '16px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
          {scoreLabel(score)}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: scoreColor(score),
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            marginBottom: 10,
          }}
        >
          {score.toLocaleString()}
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <Stat label="Distance" value={formatDistance(distanceMeters)} />
          <Stat label="Time" value={`${timeSeconds}s`} />
        </div>
      </div>

      {/* Bottom controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 16,
          right: 16,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Save to leaderboard */}
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

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            size="large"
            onClick={onLeaderboard}
            style={{
              flex: 1,
              height: 52,
              fontWeight: 600,
              borderRadius: 14,
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
            style={{
              flex: 2,
              height: 52,
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 14,
              boxShadow: '0 6px 20px rgba(22, 119, 255, 0.45)',
            }}
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
      <div style={{ color: 'white', fontWeight: 700, fontSize: 17 }}>{value}</div>
    </div>
  );
}
