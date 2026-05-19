import { useEffect, useState } from 'react';
import { Button, Typography, message } from 'antd';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import type { GameResult, RoundResult } from '../App';
import { TOTAL_ROUNDS } from '../App';

interface Props {
  address: string;
  startedAt: number;
  roundNumber: number;
  completedRounds: RoundResult[];
  submitFn: (guessedLat: number, guessedLng: number, timeSeconds: number) => Promise<GameResult>;
  onResult: (result: GameResult, guessLat: number, guessLng: number, timeSeconds: number) => void;
}

const MANHATTAN_CENTER: [number, number] = [40.7831, -73.9712];

function CenterTracker({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    moveend(e) {
      const { lat, lng } = e.target.getCenter();
      onChange(lat, lng);
    },
  });
  return null;
}

export function GamePage({ address, startedAt, roundNumber, completedRounds, submitFn, onResult }: Props) {
  const [center, setCenter] = useState<[number, number]>(MANHATTAN_CENTER);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [startedAt]);

  const handleLockIn = async () => {
    const timeSeconds = Math.floor((Date.now() - startedAt) / 1000);
    setSubmitting(true);
    try {
      const result = await submitFn(center[0], center[1], timeSeconds);
      onResult(result, center[0], center[1], timeSeconds);
    } catch {
      messageApi.error('Failed to submit. Please try again.');
      setSubmitting(false);
    }
  };

  const runningTotal = completedRounds.reduce((sum, r) => sum + r.score, 0);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeDisplay = minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${elapsed}s`;
  const timerColor = elapsed > 60 ? '#ff4d4f' : elapsed > 30 ? '#fa8c16' : 'inherit';

  return (
    <div style={{ height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      {contextHolder}

      <MapContainer
        center={MANHATTAN_CENTER}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c', 'd']}
        />
        <CenterTracker onChange={(lat, lng) => setCenter([lat, lng])} />
      </MapContainer>

      {/* Address card */}
      <div
        style={{
          position: 'absolute',
          top: '28%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRadius: 20,
          padding: '16px 24px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          textAlign: 'center',
          width: 'max-content',
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13, marginBottom: 6 }}>Where is</div>
        <Typography.Text strong style={{ fontSize: 17, color: '#111', display: 'block', lineHeight: 1.35 }}>
          {address}
        </Typography.Text>
        <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12, marginTop: 6 }}>
          Find it on the map below
        </div>
      </div>

      {/* Round badge — top left */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1000,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRadius: 16,
          padding: '10px 14px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Round</div>
        <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1, color: '#111' }}>
          {roundNumber}<span style={{ color: 'rgba(0,0,0,0.3)', fontWeight: 400, fontSize: 14 }}>/{TOTAL_ROUNDS}</span>
        </div>
        {runningTotal > 0 && (
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {runningTotal.toLocaleString()} pts
          </div>
        )}
      </div>

      {/* Timer card — top right */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1000,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRadius: 16,
          padding: '12px 14px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 20,
          fontWeight: 700,
          color: timerColor,
          minWidth: 64,
          textAlign: 'center',
        }}
      >
        {timeDisplay}
      </div>

      {/* Location indicator */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          pointerEvents: 'none',
          filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.3))',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" fill="rgba(220,38,38,0.18)" />
          <circle cx="24" cy="24" r="6" fill="rgba(220,38,38,0.9)" />
        </svg>
      </div>

      {/* Lock-in button */}
      <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 1000 }}>
        <Button
          type="primary"
          size="large"
          block
          loading={submitting}
          onClick={handleLockIn}
          style={{ height: 52, fontSize: 18, fontWeight: 700, borderRadius: 14, boxShadow: '0 6px 20px rgba(22,119,255,0.45)' }}
        >
          Lock In!
        </Button>
      </div>
    </div>
  );
}
