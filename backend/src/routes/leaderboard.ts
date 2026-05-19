import { Router } from 'express';
import pool from '../db/client';

const router = Router();

// GET /api/leaderboard — today's daily leaderboard
router.get('/', async (_req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await pool.query<{
      player_name: string;
      score: number;
      distance_meters: number;
      time_seconds: number;
      submission_id: string;
      created_at: string;
    }>(
      `SELECT player_name, score, distance_meters, time_seconds, submission_id, created_at
       FROM scores
       WHERE is_daily = TRUE AND game_date = $1
       ORDER BY score DESC
       LIMIT 20`,
      [today]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/leaderboard — save practice score (not daily)
router.post('/', async (req, res, next) => {
  try {
    const { playerName, address, distanceMeters, timeSeconds, score } = req.body as {
      playerName: string;
      address: string;
      distanceMeters: number;
      timeSeconds: number;
      score: number;
    };

    await pool.query(
      `INSERT INTO scores (player_name, address, distance_meters, time_seconds, score)
       VALUES ($1, $2, $3, $4, $5)`,
      [playerName.trim() || 'Anonymous', address, distanceMeters, timeSeconds, score]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
