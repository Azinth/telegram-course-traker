-- Drop global unique constraint on episodes.tag if exists and add unique per (module_id, tag)
DO $$
BEGIN
  -- Try drop unique constraint by name if known; otherwise drop unique index if exists
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'episodes' AND c.conname = 'episodes_tag_key'
  ) THEN
    ALTER TABLE episodes DROP CONSTRAINT episodes_tag_key;
  END IF;
EXCEPTION WHEN others THEN
  -- ignore
END $$;

-- Some setups might have a unique index instead of constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'episodes_tag_key'
  ) THEN
    DROP INDEX episodes_tag_key;
  END IF;
EXCEPTION WHEN others THEN
END $$;

-- Ensure (module_id, tag) unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_module_tag_unique ON episodes(module_id, tag);
