-- Add position column to courses and backfill per user
ALTER TABLE courses ADD COLUMN IF NOT EXISTS position INTEGER;

-- Backfill positions for existing rows per user by created_at ascending
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT user_id FROM courses GROUP BY user_id LOOP
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
      FROM courses WHERE user_id = rec.user_id
    )
    UPDATE courses c SET position = o.rn
    FROM ordered o
    WHERE c.id = o.id;
  END LOOP;
END $$;

-- Ensure not null going forward with default 0 for any missing
ALTER TABLE courses ALTER COLUMN position SET DEFAULT 0;
UPDATE courses SET position = 0 WHERE position IS NULL;
ALTER TABLE courses ALTER COLUMN position SET NOT NULL;

-- Helpful index for ordering by user and position
CREATE INDEX IF NOT EXISTS idx_courses_user_position ON courses(user_id, position);
