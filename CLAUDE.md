# Manhattan Guessr

A geo-guessing game for Manhattan addresses.

## Architecture

- **Frontend**: React + Ant Design + react-leaflet → Vercel
- **Backend**: TypeScript + Express → AWS Lambda (via @vendia/serverless-express)
- **Database**: Neon PostgreSQL (project: `shiny-smoke-41131425`)

## How the game works

1. Backend fetches a random address from NYC Open Data (dataset `g6pj-hd8k`, borough=MN)
2. Address + game UUID returned to frontend; true coordinates stored in server memory
3. User drags the map (crosshair at center = guess), locks in answer + enters name
4. Backend calculates Haversine distance, computes score, saves to `scores` table
5. Frontend shows results map with both locations + score

## Scoring formula

`score = round(5000 × exp(−distance_meters / 500)) + max(0, 1000 − time_seconds × 10)`

- Max score: 6,000 (perfect guess, instant)
- Distance score halves roughly every 350m — exponential decay makes precision matter
- Time bonus: up to 1,000 extra points, loses 10pts/sec, zeroes out at 100s

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `PORT` | Local dev port (default 3001) |

## Database schema

```sql
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL,
  address TEXT NOT NULL,
  distance_meters NUMERIC NOT NULL,
  time_seconds NUMERIC NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Running locally

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

## NYC Open Data

Addresses are fetched live from the NYC Address Points dataset:
- Endpoint: `https://data.cityofnewyork.us/resource/g6pj-hd8k.json`
- Filter: `borough=MN` (Manhattan)
- ~1,050,000 records; random offset used to pick an address each game
