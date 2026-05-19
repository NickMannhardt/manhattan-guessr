import express from 'express';
import cors from 'cors';
import gameRouter from './routes/game';
import leaderboardRouter from './routes/leaderboard';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/game', gameRouter);
app.use('/api/leaderboard', leaderboardRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
