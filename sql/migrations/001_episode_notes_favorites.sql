-- Episode notes and favorites
CREATE TABLE IF NOT EXISTS episode_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, episode_id)
);

CREATE TABLE IF NOT EXISTS episode_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, episode_id)
);

CREATE INDEX IF NOT EXISTS idx_episode_notes_user ON episode_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_episode_fav_user ON episode_favorites(user_id);
