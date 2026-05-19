import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface Session {
  address: string;
  lat: number;
  lng: number;
}

const sessions = new Map<string, Session>();

// MapPLUTO — tax lot dataset with addresses, lat/lng for all NYC parcels
const NYC_API = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';
const MANHATTAN_RECORD_COUNT = 42_600;

interface NycRecord {
  address?: string;
  latitude?: string;
  longitude?: string;
  zipcode?: string;
}

function formatAddress(raw: string, zipcode?: string): string {
  // Title-case ALL-CAPS NYC data, then expand common abbreviations
  const titled = raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const expanded = titled
    .replace(/\bAve\b/g, 'Avenue')
    .replace(/\bBlvd\b/g, 'Boulevard')
    .replace(/\bSt\b/g, 'Street')
    .replace(/\bPl\b/g, 'Place')
    .replace(/\bRd\b/g, 'Road')
    .replace(/\bDr\b/g, 'Drive')
    .replace(/\bPkwy\b/g, 'Parkway')
    .replace(/\bLn\b/g, 'Lane')
    .replace(/\bCt\b/g, 'Court');
  const zip = zipcode ? ` ${zipcode}` : '';
  return `${expanded}, Manhattan, NY${zip}`;
}

async function fetchRandomManhattanAddress(): Promise<Session> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const offset = Math.floor(Math.random() * MANHATTAN_RECORD_COUNT);
    const url = `${NYC_API}?borough=MN&$limit=1&$offset=${offset}&$select=address,latitude,longitude,zipcode`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) continue;

    const data = (await res.json()) as NycRecord[];
    if (!data.length) continue;

    const record = data[0];
    const lat = parseFloat(record.latitude ?? '');
    const lng = parseFloat(record.longitude ?? '');
    if (isNaN(lat) || isNaN(lng) || !record.address) continue;

    const address = formatAddress(record.address, record.zipcode);
    return { address, lat, lng };
  }
  throw new Error('Failed to fetch a valid address from NYC Open Data after 5 attempts');
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get('/start', async (_req, res, next) => {
  try {
    const session = await fetchRandomManhattanAddress();
    const gameId = uuidv4();
    sessions.set(gameId, session);

    // Evict oldest session when cache grows too large
    if (sessions.size > 1000) {
      const oldest = sessions.keys().next().value;
      if (oldest) sessions.delete(oldest);
    }

    res.json({ gameId, address: session.address });
  } catch (err) {
    next(err);
  }
});

router.post('/submit', async (req, res, next) => {
  try {
    const { gameId, guessedLat, guessedLng, timeSeconds } = req.body as {
      gameId: string;
      guessedLat: number;
      guessedLng: number;
      timeSeconds: number;
    };

    const session = sessions.get(gameId);
    if (!session) {
      res.status(404).json({ error: 'Game session not found or expired' });
      return;
    }
    sessions.delete(gameId);

    const distanceMeters = Math.round(haversineMeters(guessedLat, guessedLng, session.lat, session.lng));
    const distanceScore = 5000 * Math.exp(-distanceMeters / 400);
    const timeMultiplier = Math.max(0.2, 1 - timeSeconds / 120);
    const score = Math.round(distanceScore * timeMultiplier);

    res.json({
      score,
      distanceMeters,
      trueLat: session.lat,
      trueLng: session.lng,
      address: session.address,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
