import { Button } from 'antd';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import type { RoundResult } from '../App';
import { TOTAL_ROUNDS } from '../App';

interface Props {
  roundNumber: number;
  latest: RoundResult;
  completedRounds: RoundResult[];
  nextGame: { gameId: string; address: string } | null;
  onNext: (nextGame: { gameId: string; address: string } | null) => void;
}

function formatDistance(meters: number): string {
  const feet = Math.round(meters * 3.281);
  if (feet < 5280) return `${feet.toLocaleString()} ft`;
  return `${(feet / 5280).toFixed(2)} mi`;
}

function scoreColor(score: number): string {
  if (score >= 4000) return '#f5a623';
  if (score >= 2500) return '#52c41a';
  if (score >= 1000) return '#fa8c16';
  return '#f5222d';
}

export function RoundResults({ roundNumber, latest, completedRounds, nextGame, onNext }: Props) {
  const { score, distanceMeters, trueLat, trueLng, guessLat, guessLng, address, timeSeconds } = latest;
  const runningTotal = completedRounds.reduce((sum, r) => sum + r.score, 0);
  const isLast = roundNumber >= TOTAL_ROUNDS;

  const PAD = 0.004;
  const bounds: LatLngBoundsExpression = [
    [Math.min(guessLat, trueLat) - PAD, Math.min(guessLng, trueLng) - PAD],
    [Math.max(guessLat, trueLat) + PAD, Math.max(guessLng, trueLng) + PAD],
  ];

  return (
    <div style={{ height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <MapContainer bounds={bounds} style={{ height: '100%', width: '100%' }} zoomControl={false}>
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
          pathOptions={{ color: 'rgba(0,0,0,0.3)', dashArray: '6 5', weight: 2 }}
        />
      </MapContainer>

      {/* Round score card */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 1000,
          background: 'rgba(10,14,23,0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 20,
          padding: '16px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
          Round {roundNumber} of {TOTAL_ROUNDS}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: scoreColor(score), lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            +{score.toLocaleString()}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>pts</div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
          <Stat label="Distance" value={formatDistance(distanceMeters)} />
          <Stat label="Time" value={`${timeSeconds}s`} />
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Running total</span>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
            {runningTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Next button */}
      <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 1000 }}>
        <Button
          type="primary"
          size="large"
          block
          onClick={() => onNext(nextGame)}
          style={{ height: 52, fontSize: 18, fontWeight: 700, borderRadius: 14, boxShadow: '0 6px 20px rgba(22,119,255,0.45)' }}
        >
          {isLast ? 'See Final Results' : `Round ${roundNumber + 1} →`}
        </Button>
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
