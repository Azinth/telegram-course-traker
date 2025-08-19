/**
 * Initial database setup migration
 * Converts init.sql structure to node-pg-migrate format
 * Creates core tables: users, courses, modules, episodes, user_episode_progress, course_sessions
 */

exports.up = (pgm) => {
  // Users table
  pgm.createTable("users", {
    id: {
      type: "text",
      primaryKey: true,
    },
    name: {
      type: "text",
      notNull: true,
    },
    email: {
      type: "text",
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: "text",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Courses table
  pgm.createTable("courses", {
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
    title: {
      type: "text",
      notNull: true,
    },
    raw_index: {
      type: "text",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    completed_at: {
      type: "timestamptz",
    },
  });

  // Modules table
  pgm.createTable("modules", {
    id: {
      type: "text",
      primaryKey: true,
    },
    course_id: {
      type: "text",
      notNull: true,
      references: "courses(id)",
      onDelete: "CASCADE",
    },
    title: {
      type: "text",
      notNull: true,
    },
    position: {
      type: "integer",
      notNull: true,
    },
  });

  // Episodes table
  pgm.createTable("episodes", {
    id: {
      type: "text",
      primaryKey: true,
    },
    module_id: {
      type: "text",
      notNull: true,
      references: "modules(id)",
      onDelete: "CASCADE",
    },
    tag: {
      type: "text",
      notNull: true,
      unique: true,
    },
    title: {
      type: "text",
    },
    position: {
      type: "integer",
      notNull: true,
    },
  });

  // User episode progress table
  pgm.createTable("user_episode_progress", {
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
    completed: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    completed_at: {
      type: "timestamptz",
    },
  });

  // Add composite primary key for user_episode_progress
  pgm.addConstraint("user_episode_progress", "user_episode_progress_pkey", {
    primaryKey: ["user_id", "episode_id"],
  });

  // Course sessions table
  pgm.createTable("course_sessions", {
    id: {
      type: "text",
      primaryKey: true,
    },
    course_id: {
      type: "text",
      notNull: true,
      references: "courses(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "text",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    started_at: {
      type: "timestamptz",
      notNull: true,
    },
    ended_at: {
      type: "timestamptz",
    },
  });

  // Create indexes
  pgm.createIndex("modules", "course_id", { name: "idx_modules_course" });
  pgm.createIndex("episodes", "module_id", { name: "idx_episodes_module" });
  pgm.createIndex("user_episode_progress", "user_id", {
    name: "idx_progress_user",
  });
  pgm.createIndex("course_sessions", ["user_id", "course_id"], {
    name: "idx_sessions_user_course",
  });
};

exports.down = (pgm) => {
  // Drop indexes first
  pgm.dropIndex("course_sessions", ["user_id", "course_id"], {
    name: "idx_sessions_user_course",
  });
  pgm.dropIndex("user_episode_progress", "user_id", {
    name: "idx_progress_user",
  });
  pgm.dropIndex("episodes", "module_id", { name: "idx_episodes_module" });
  pgm.dropIndex("modules", "course_id", { name: "idx_modules_course" });

  // Drop tables in reverse order (respecting foreign key dependencies)
  pgm.dropTable("course_sessions");
  pgm.dropTable("user_episode_progress");
  pgm.dropTable("episodes");
  pgm.dropTable("modules");
  pgm.dropTable("courses");
  pgm.dropTable("users");
};
