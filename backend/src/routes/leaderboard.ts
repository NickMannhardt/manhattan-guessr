import { Router } from 'express';
import pool from '../db/client';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query<{
      player_name: string;
      address: string;
      distance_meters: number;
      time_seconds: number;
      score: number;
      created_at: string;
    }>(
      `SELECT player_name, address, distance_meters, time_seconds, score, created_at
       FROM scores
       ORDER BY score DESC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

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
