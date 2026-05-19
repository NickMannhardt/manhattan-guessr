# Manhattan Guessr

A mobile-first geo-guessing game. You're given a real Manhattan address and must drag the map to find it. Score is based on accuracy and speed.

## Stack

- **Frontend**: React, Ant Design, react-leaflet (OpenStreetMap)
- **Backend**: TypeScript, Express, deployed to AWS Lambda
- **Database**: Neon (PostgreSQL) — stores top scores

## Getting started

1. Copy `.env.example` to `backend/.env` and fill in `DATABASE_URL`
2. Run the backend: `cd backend && npm install && npm run dev`
3. Run the frontend: `cd frontend && npm install && npm run dev`
4. Open [http://localhost:5173](http://localhost:5173)

## How to play

1. An address in Manhattan appears at the top
2. Drag the map until the 📍 pin is over where you think the address is
3. Tap **Lock In!** and enter your name
4. See your score and how close you were — the 🔵 blue dot is your guess, the 🔴 red dot is the real location

## Scoring

`score = max(0, 10,000 − distance(m) − time(s) × 50)`

A perfect guess in zero seconds scores 10,000. Every meter costs 1 point; every second costs 50 points.
