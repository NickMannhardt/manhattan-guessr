CREATE TABLE daily_round_guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL,
  game_date DATE NOT NULL,
  round_index INTEGER NOT NULL,
  guessed_lat NUMERIC NOT NULL,
  guessed_lng NUMERIC NOT NULL,
  score INTEGER,
  distance_meters NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON daily_round_guesses (game_date, round_index);
CREATE INDEX ON daily_round_guesses (submission_id);
