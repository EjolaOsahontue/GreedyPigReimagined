-- ========== ENUMS ==========
CREATE TYPE game_status  AS ENUM ('IN_PROGRESS', 'FINISHED', 'ABANDONED');
CREATE TYPE game_mode    AS ENUM ('CLASSIC', 'VS_BOT', 'MULTIPLAYER');
CREATE TYPE turn_outcome AS ENUM ('OPEN', 'BANKED', 'BUSTED');

-- ========== GAMES ==========
CREATE TABLE games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode             game_mode   NOT NULL DEFAULT 'CLASSIC',
  status           game_status NOT NULL DEFAULT 'IN_PROGRESS',
  target_score     INT NOT NULL DEFAULT 100 CHECK (target_score BETWEEN 25 AND 1000),
  current_seat     INT NOT NULL DEFAULT 0 CHECK (current_seat >= 0),
  turn_number      INT NOT NULL DEFAULT 1,            -- global counter, +1 every time the turn passes
  last_roll_value  INT CHECK (last_roll_value BETWEEN 1 AND 6),
  last_roll_player_id UUID,                           -- who made the last roll (no FK, avoids a circular dependency)
  winner_player_id UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ
);

-- ========== PLAYERS IN A GAME ==========
CREATE TABLE game_players (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id             UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  display_name        VARCHAR(20) NOT NULL DEFAULT '',   -- empty allowed: the UI shows a pig nickname
  pig_index           INT NOT NULL DEFAULT 0 CHECK (pig_index BETWEEN 0 AND 28),
  is_bot              BOOLEAN NOT NULL DEFAULT false,
  seat                INT NOT NULL CHECK (seat >= 0),
  total_score         INT NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  turn_score          INT NOT NULL DEFAULT 0 CHECK (turn_score >= 0),
  turns_taken         INT NOT NULL DEFAULT 0,
  rolls_this_turn     INT NOT NULL DEFAULT 0,
  UNIQUE (game_id, seat)
);

ALTER TABLE games
  ADD CONSTRAINT fk_games_winner
  FOREIGN KEY (winner_player_id) REFERENCES game_players(id) ON DELETE SET NULL;

-- ========== TURNS (one row per turn: powers stats) ==========
CREATE TABLE turns (
  id              BIGSERIAL PRIMARY KEY,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_player_id  UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  turn_number     INT NOT NULL,
  points          INT NOT NULL DEFAULT 0,   -- points banked, or turn points lost on a bust
  outcome         turn_outcome NOT NULL DEFAULT 'OPEN',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_player_id, turn_number)
);

-- ========== ROLLS (audit log of every dice roll) ==========
CREATE TABLE rolls (
  id              BIGSERIAL PRIMARY KEY,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_player_id  UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  turn_id         BIGINT REFERENCES turns(id) ON DELETE CASCADE,
  value           INT NOT NULL CHECK (value BETWEEN 1 AND 6),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== RESULTS (written ONLY by POST /games/:id/finish) ==========
CREATE TABLE results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_player_id  UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  display_name    VARCHAR(20) NOT NULL DEFAULT '',
  is_bot          BOOLEAN NOT NULL DEFAULT false,   -- this row is a bot player
  vs_bot          BOOLEAN NOT NULL DEFAULT false,   -- the game had a bot opponent
  final_score     INT NOT NULL,
  is_winner       BOOLEAN NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, game_player_id)                  -- finish can't create duplicates
);

-- ========== INDEXES ==========
CREATE INDEX idx_game_players_game ON game_players(game_id);
CREATE INDEX idx_game_players_name ON game_players(lower(display_name));
CREATE INDEX idx_turns_player      ON turns(game_player_id);
CREATE INDEX idx_turns_game        ON turns(game_id, turn_number);
CREATE INDEX idx_rolls_game        ON rolls(game_id, created_at);
CREATE INDEX idx_games_status      ON games(status, finished_at);
CREATE INDEX idx_results_name      ON results(lower(display_name), created_at DESC);