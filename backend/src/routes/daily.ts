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
    const submissionId = uuidv4();
    dailySessions.set(dailySessionId, { date, rounds });

    if (dailySessions.size > 2000) {
      const oldest = dailySessions.keys().next().value;
      if (oldest) dailySessions.delete(oldest);
    }

    res.json({ dailySessionId, submissionId, date, addresses: rounds.map((r) => r.address) });
  } catch (err) {
    next(err);
  }
});

// POST /api/daily/check — reveal true location + score; save guess if submissionId provided
router.post('/check', async (req, res, next) => {
  try {
    const { roundIndex, guessedLat, guessedLng, timeSeconds, submissionId } = req.body as {
      roundIndex: number;
      guessedLat: number;
      guessedLng: number;
      timeSeconds: number;
      submissionId?: string;
    };

    if (roundIndex < 0 || roundIndex >= TOTAL_ROUNDS) {
      res.status(400).json({ error: 'Invalid round index' });
      return;
    }

    const rounds = await getDailyRounds(todayStr());
    const round = rounds[roundIndex];

    const distanceMeters = Math.round(haversineMeters(guessedLat, guessedLng, round.lat, round.lng));
    const distanceScore = 5000 * Math.exp(-distanceMeters / 400);
    const timeMultiplier = Math.max(0.2, 1 - timeSeconds / 120);
    const score = Math.round(distanceScore * timeMultiplier);

    if (submissionId) {
      const date = todayStr();
      pool.query(
        `INSERT INTO daily_round_guesses (submission_id, game_date, round_index, guessed_lat, guessed_lng, score, distance_meters)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [submissionId, date, roundIndex, guessedLat, guessedLng, score, distanceMeters]
      ).catch(() => {});
    }

    res.json({ score, distanceMeters, trueLat: round.lat, trueLng: round.lng, address: round.address });
  } catch (err) {
    next(err);
  }
});

// POST /api/daily/submit — save final score using client-provided submissionId
router.post('/submit', async (req, res, next) => {
  try {
    const { submissionId, playerName, totalScore, avgDistanceMeters, totalTimeSeconds } = req.body as {
      submissionId: string;
      playerName: string;
      totalScore: number;
      avgDistanceMeters: number;
      totalTimeSeconds: number;
    };

    const date = todayStr();
    const name = playerName.trim() || 'Anonymous';

    await pool.query(
      `INSERT INTO scores (player_name, address, distance_meters, time_seconds, score, is_daily, game_date, submission_id)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)
       ON CONFLICT (submission_id) DO NOTHING`,
      [name, `Daily Challenge – ${date}`, avgDistanceMeters, totalTimeSeconds, totalScore, date, submissionId]
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

// GET /api/daily/guesses/:roundIndex — all players' guesses for today's round
router.get('/guesses/:roundIndex', async (req, res, next) => {
  try {
    const roundIndex = parseInt(req.params.roundIndex, 10);
    if (isNaN(roundIndex) || roundIndex < 0 || roundIndex >= TOTAL_ROUNDS) {
      res.status(400).json({ error: 'Invalid round index' });
      return;
    }

    const date = todayStr();
    const result = await pool.query<{ guessed_lat: string; guessed_lng: string }>(
      `SELECT guessed_lat, guessed_lng FROM daily_round_guesses WHERE game_date = $1 AND round_index = $2`,
      [date, roundIndex]
    );

    res.json(result.rows.map((r) => ({
      guessedLat: parseFloat(r.guessed_lat),
      guessedLng: parseFloat(r.guessed_lng),
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/daily/player/:submissionId — a player's full round breakdown for the leaderboard map
router.get('/player/:submissionId', async (req, res, next) => {
  try {
    const { submissionId } = req.params;

    const result = await pool.query<{
      round_index: number;
      guessed_lat: string;
      guessed_lng: string;
      score: number;
      distance_meters: string;
      game_date: string;
    }>(
      `SELECT round_index, guessed_lat, guessed_lng, score, distance_meters, game_date
       FROM daily_round_guesses WHERE submission_id = $1 ORDER BY round_index`,
      [submissionId]
    );

    if (!result.rows.length) {
      res.status(404).json({ error: 'No guesses found' });
      return;
    }

    const dateStr = String(result.rows[0].game_date).slice(0, 10);

    const rounds = await getDailyRounds(dateStr);

    const data = result.rows.map((r) => {
      const round = rounds[r.round_index];
      return {
        roundIndex: r.round_index,
        guessedLat: parseFloat(r.guessed_lat),
        guessedLng: parseFloat(r.guessed_lng),
        trueLat: round?.lat ?? 0,
        trueLng: round?.lng ?? 0,
        address: round?.address ?? '',
        score: r.score,
        distanceMeters: parseFloat(r.distance_meters),
      };
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
