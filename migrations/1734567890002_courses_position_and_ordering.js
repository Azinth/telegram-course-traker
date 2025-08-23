/**
 * Add position to courses for custom ordering and related indexes
 */

exports.up = async (pgm) => {
  // Add column with default 0 temporarily
  pgm.addColumn("courses", {
    position: { type: "integer", notNull: true, default: 0 },
  });

  // Backfill per-user positions by created_at ASC
  pgm.sql(`
    WITH ordered AS (
      SELECT id, user_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
      FROM courses
    )
    UPDATE courses c
    SET position = o.rn
    FROM ordered o
    WHERE c.id = o.id;
  `);

  // Helpful index for ordering
  pgm.createIndex("courses", ["user_id", "position"], {
    name: "idx_courses_user_position",
  });
};

exports.down = async (pgm) => {
  pgm.dropIndex("courses", ["user_id", "position"], {
    name: "idx_courses_user_position",
  });
  pgm.dropColumn("courses", "position");
};
