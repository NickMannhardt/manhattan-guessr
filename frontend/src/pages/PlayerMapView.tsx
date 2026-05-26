import { useEffect, useState } from 'react';
import { Button, Spin } from 'antd';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';

interface PlayerRound {
  roundIndex: number;
  guessedLat: number;
  guessedLng: number;
  trueLat: number;
  trueLng: number;
  address: string;
  score: number;
  distanceMeters: number;
}

interface Props {
  submissionId: string;
  playerName: string;
  totalScore: number;
  onBack: () => void;
}

const ROUND_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1'];

function formatDistance(meters: number): string {
  const feet = Math.round(meters * 3.281);
  if (feet < 5280) return `${feet.toLocaleString()} ft`;
  return `${(feet / 5280).toFixed(2)} mi`;
}

export function PlayerMapView({ submissionId, playerName, totalScore, onBack }: Props) {
  const [rounds, setRounds] = useState<PlayerRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/daily/player/${submissionId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json() as Promise<PlayerRound[]>;
      })
      .then(setRounds)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [submissionId]);

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#001529' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !rounds.length) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#001529', gap: 16 }}>
        <div style={{ color: 'rgba(255,255,255,0.5)' }}>Could not load this player's guesses.</div>
        <Button onClick={onBack}>Back</Button>
      </div>
    );
  }

  const allLats = rounds.flatMap((r) => [r.guessedLat, r.trueLat]);
  const allLngs = rounds.flatMap((r) => [r.guessedLng, r.trueLng]);
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
        {rounds.map((r, i) => {
          const color = ROUND_COLORS[i % ROUND_COLORS.length];
          return (
            <span key={i}>
              <CircleMarker
                center={[r.guessedLat, r.guessedLng]}
                radius={7}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -8]}>Round {i + 1} — guess</Tooltip>
              </CircleMarker>
              <CircleMarker
                center={[r.trueLat, r.trueLng]}
                radius={7}
                pathOptions={{ color, fillColor: 'white', fillOpacity: 0.9, weight: 2.5 }}
              >
                <Tooltip direction="top" offset={[0, -8]}>{r.address}</Tooltip>
              </CircleMarker>
              <Polyline
                positions={[[r.guessedLat, r.guessedLng], [r.trueLat, r.trueLng]]}
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
          {playerName}
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, color: '#faad14', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>
          {totalScore.toLocaleString()}
          <span style={{ fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>pts</span>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rounds.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ROUND_COLORS[i % ROUND_COLORS.length], flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.address}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{formatDistance(r.distanceMeters)}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  {r.score.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Back button */}
      <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 1000 }}>
        <Button
          size="large"
          block
          onClick={onBack}
          style={{
            height: 52, fontSize: 16, fontWeight: 600, borderRadius: 14,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
          }}
        >
          ← Back to Leaderboard
        </Button>
      </div>
    </div>
  );
}
