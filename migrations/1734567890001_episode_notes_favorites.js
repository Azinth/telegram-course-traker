/**
 * Episode notes and favorites migration
 * Converts 001_episode_notes_favorites.sql to node-pg-migrate format
 * Creates tables: episode_notes, episode_favorites
 */

exports.up = (pgm) => {
  // Episode notes table
  pgm.createTable("episode_notes", {
    id: {
      type: "text",
      primaryKey: true,
    },
    user_id: {
      type: "text",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    episode_id: {
      type: "text",
      notNull: true,
      references: "episodes(id)",
      onDelete: "CASCADE",
    },
    content: {
      type: "text",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Add unique constraint for user_id and episode_id combination
  pgm.addConstraint("episode_notes", "episode_notes_user_episode_unique", {
    unique: ["user_id", "episode_id"],
  });

  // Episode favorites table
  pgm.createTable("episode_favorites", {
    user_id: {
      type: "text",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    episode_id: {
      type: "text",
      notNull: true,
      references: "episodes(id)",
      onDelete: "CASCADE",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Add composite primary key for episode_favorites
  pgm.addConstraint("episode_favorites", "episode_favorites_pkey", {
    primaryKey: ["user_id", "episode_id"],
  });

  // Create indexes
  pgm.createIndex("episode_notes", "user_id", {
    name: "idx_episode_notes_user",
  });
  pgm.createIndex("episode_favorites", "user_id", {
    name: "idx_episode_fav_user",
  });
};

exports.down = (pgm) => {
  // Drop indexes first
  pgm.dropIndex("episode_favorites", "user_id", {
    name: "idx_episode_fav_user",
  });
  pgm.dropIndex("episode_notes", "user_id", { name: "idx_episode_notes_user" });

  // Drop tables
  pgm.dropTable("episode_favorites");
  pgm.dropTable("episode_notes");
};
