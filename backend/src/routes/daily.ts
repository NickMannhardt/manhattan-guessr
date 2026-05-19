import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/client';

const router = Router();

const NYC_API = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';
const MANHATTAN_RECORD_COUNT = 42_600;
const TOTAL_ROUNDS = 5;

interface DailyRound {
  address: string;
  lat: number;
  lng: number;
}

interface DailySession {
  date: string;
  rounds: DailyRound[];
}

const dailySessions = new Map<string, DailySession>();

interface NycRecord {
  address?: string;
  latitude?: string;
  longitude?: string;
  zipcode?: string;
}

function formatAddress(raw: string, zipcode?: string): string {
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

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = Math.imul(31, hash) + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDailyOffsets(dateStr: string): number[] {
  const rand = mulberry32(dateToSeed(dateStr));
  const offsets: number[] = [];
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    offsets.push(Math.floor(rand() * MANHATTAN_RECORD_COUNT));
  }
  return offsets;
}

async function fetchAddressAtOffset(offset: number): Promise<DailyRound | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = `${NYC_API}?borough=MN&$limit=1&$offset=${offset}&$select=address,latitude,longitude,zipcode`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = (await res.json()) as NycRecord[];
      if (!data.length) continue;
      const record = data[0];
      const lat = parseFloat(record.latitude ?? '');
      const lng = parseFloat(record.longitude ?? '');
      if (isNaN(lat) || isNaN(lng) || !record.address) continue;
      return { address: formatAddress(record.address, record.zipcode), lat, lng };
    } catch {
      continue;
    }
  }
  return null;
}

// Cache today's rounds in memory so repeated /start calls are instant
let cachedDate: string | null = null;
let cachedRounds: DailyRound[] | null = null;

async function getDailyRounds(dateStr: string): Promise<DailyRound[]> {
  if (cachedDate === dateStr && cachedRounds) {
    return cachedRounds;
  }
  const offsets = getDailyOffsets(dateStr);
  const fetched = await Promise.all(offsets.map(fetchAddressAtOffset));
  const rounds = fetched.filter((r): r is DailyRound => r !== null);
  if (rounds.length < TOTAL_ROUNDS) {
    throw new Error('Could not fetch enough valid daily addresses');
  }
  cachedDate = dateStr;
  cachedRounds = rounds;
  return rounds;
}

// GET /api/daily/start
router.get('/start', async (_req, res, next) => {
  try {
    const date = todayStr();
    const rounds = await getDailyRounds(date);
    const dailySessionId = uuidv4();
    dailySessions.set(dailySessionId, { date, rounds });

    if (dailySessions.size > 2000) {
      const oldest = dailySessions.keys().next().value;
      if (oldest) dailySessions.delete(oldest);
    }

    res.json({ dailySessionId, date, addresses: rounds.map((r) => r.address) });
  } catch (err) {
    next(err);
  }
});

// POST /api/daily/check — reveal true location + score for one round
router.post('/check', async (req, res, next) => {
  try {
    const { dailySessionId, roundIndex, guessedLat, guessedLng, timeSeconds } = req.body as {
      dailySessionId: string;
      roundIndex: number;
      guessedLat: number;
      guessedLng: number;
      timeSeconds: number;
    };

    const session = dailySessions.get(dailySessionId);
    if (!session) {
      res.status(404).json({ error: 'Daily session not found or expired' });
      return;
    }

    const round = session.rounds[roundIndex];
    if (!round) {
      res.status(400).json({ error: 'Invalid round index' });
      return;
    }

    const distanceMeters = Math.round(haversineMeters(guessedLat, guessedLng, round.lat, round.lng));
    const distanceScore = 5000 * Math.exp(-distanceMeters / 400);
    const timeMultiplier = Math.max(0.2, 1 - timeSeconds / 120);
    const score = Math.round(distanceScore * timeMultiplier);

    res.json({ score, distanceMeters, trueLat: round.lat, trueLng: round.lng, address: round.address });
  } catch (err) {
    next(err);
  }
});

// POST /api/daily/submit — save final score, return submissionId
router.post('/submit', async (req, res, next) => {
  try {
    const { dailySessionId, playerName, totalScore, avgDistanceMeters, totalTimeSeconds } = req.body as {
      dailySessionId: string;
      playerName: string;
      totalScore: number;
      avgDistanceMeters: number;
      totalTimeSeconds: number;
    };

    const session = dailySessions.get(dailySessionId);
    if (!session) {
      res.status(404).json({ error: 'Daily session not found or expired' });
      return;
    }

    const submissionId = uuidv4();
    const name = playerName.trim() || 'Anonymous';

    await pool.query(
      `INSERT INTO scores (player_name, address, distance_meters, time_seconds, score, is_daily, game_date, submission_id)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)`,
      [name, `Daily Challenge – ${session.date}`, avgDistanceMeters, totalTimeSeconds, totalScore, session.date, submissionId]
    );

    res.json({ submissionId });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/daily/:submissionId — update player name
router.patch('/:submissionId', async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { playerName } = req.body as { playerName: string };

    const name = playerName.trim() || 'Anonymous';
    const result = await pool.query(
      `UPDATE scores SET player_name = $1 WHERE submission_id = $2 AND is_daily = TRUE`,
      [name, submissionId]
    );

    if (!result.rowCount) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
