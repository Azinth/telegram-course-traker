# Database Migration Workflow

This document provides comprehensive guidance on working with database migrations in the Course Tracker project using node-pg-migrate.

## Table of Contents

- [Overview](#overview)
- [Creating New Migrations](#creating-new-migrations)
- [Migration Execution Process](#migration-execution-process)
- [Rollback Procedures](#rollback-procedures)
- [Best Practices](#best-practices)
- [API Integration](#api-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The Course Tracker project uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for database schema management. This tool provides:

- Version-controlled database schema changes
- Automatic rollback capabilities
- Transaction-safe migrations
- Integration with existing PostgreSQL databases

### Migration Files Location

All migration files are stored in the `migrations/` directory at the project root. Each migration file follows the naming convention:

```
{timestamp}_{migration_name}.js
```

Example: `1734567890000_initial_database_setup.js`

## Creating New Migrations

### 1. Generate Migration File

Use the npm script to create a new migration:

```bash
npm run migrate:create add_user_preferences_table
```

This creates a new file in the `migrations/` directory with the current timestamp.

### 2. Migration File Structure

Each migration file exports two functions:

```javascript
/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Forward migration logic
  pgm.createTable("user_preferences", {
    id: "id",
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    theme: {
      type: "varchar(20)",
      default: "light",
    },
    notifications_enabled: {
      type: "boolean",
      default: true,
    },
    created_at: {
      type: "timestamp",
      default: pgm.func("current_timestamp"),
    },
  });

  // Add indexes
  pgm.createIndex("user_preferences", "user_id");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Rollback migration logic
  pgm.dropTable("user_preferences");
};
```

### 3. Common Migration Operations

#### Creating Tables

```javascript
pgm.createTable("table_name", {
  id: "id", // Auto-incrementing primary key
  name: { type: "varchar(255)", notNull: true },
  email: { type: "varchar(255)", unique: true },
  created_at: { type: "timestamp", default: pgm.func("current_timestamp") },
});
```

#### Adding Columns

```javascript
pgm.addColumn("users", {
  last_login: { type: "timestamp", allowNull: true },
});
```

#### Creating Indexes

```javascript
pgm.createIndex("users", "email");
pgm.createIndex("users", ["created_at", "status"], {
  name: "idx_users_created_status",
});
```

#### Adding Foreign Keys

```javascript
pgm.addConstraint("user_preferences", "fk_user_preferences_user_id", {
  foreignKeys: {
    columns: "user_id",
    references: "users(id)",
    onDelete: "CASCADE",
  },
});
```

## Migration Execution Process

### 1. Local Development

Execute migrations in your development environment:

```bash
# Run all pending migrations
npm run migrate:up

# Check migration status
curl -X GET http://localhost:3000/api/migrations \
  -H "Authorization: Bearer <your-token>"
```

### 2. Production Deployment

For production deployments, migrations can be executed via:

#### Option A: Command Line (Recommended for CI/CD)

```bash
NODE_ENV=production npm run migrate:up
```

#### Option B: API Endpoint (For manual deployment)

```bash
curl -X POST https://your-domain.com/api/migrations \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json"
```

### 3. Migration Execution Order

Migrations are executed in chronological order based on their timestamp. The system tracks executed migrations in the `pgmigrations` table.

## Rollback Procedures

### 1. Single Migration Rollback

Roll back the most recent migration:

```bash
npm run migrate:down
```

### 2. Multiple Migration Rollback

To rollback multiple migrations, run the down command multiple times:

```bash
npm run migrate:down  # Rollback latest
npm run migrate:down  # Rollback second latest
```

### 3. Rollback to Specific Migration

Currently not directly supported by our scripts. To rollback to a specific migration:

1. Identify the target migration timestamp
2. Manually run down migrations until you reach the target
3. Consider creating a custom script for this scenario

### 4. Emergency Rollback

In case of critical issues:

1. **Stop the application** to prevent further database operations
2. **Backup the database** before any rollback operations
3. **Execute rollback** using the down migration
4. **Verify data integrity** after rollback
5. **Restart application** once issues are resolved

## Best Practices

### 1. Migration Design

- **Atomic Operations**: Each migration should represent a single, logical change
- **Reversible Changes**: Always implement proper `down` functions
- **Data Safety**: Never delete data without explicit backup procedures
- **Performance**: Consider the impact of migrations on large tables

### 2. Testing Migrations

```bash
# Test migration up
npm run migrate:up

# Verify changes
psql $DATABASE_URL -c "\d+ table_name"

# Test rollback
npm run migrate:down

# Verify rollback
psql $DATABASE_URL -c "\d+ table_name"

# Re-apply for final state
npm run migrate:up
```

### 3. Code Review Checklist

- [ ] Migration has both `up` and `down` functions
- [ ] Down function properly reverses all changes
- [ ] No data loss in rollback scenarios
- [ ] Proper indexing for performance
- [ ] Foreign key constraints are appropriate
- [ ] Migration is tested locally

### 4. Naming Conventions

Use descriptive names for migrations:

```bash
# Good
npm run migrate:create add_user_preferences_table
npm run migrate:create add_email_index_to_users
npm run migrate:create remove_deprecated_status_column

# Avoid
npm run migrate:create update_users
npm run migrate:create fix_database
npm run migrate:create changes
```

### 5. Data Migrations

For migrations involving data transformation:

```javascript
exports.up = async (pgm) => {
  // 1. Add new column
  pgm.addColumn("users", {
    full_name: { type: "varchar(255)" },
  });

  // 2. Populate new column (use raw SQL for complex operations)
  await pgm.sql(`
    UPDATE users 
    SET full_name = CONCAT(first_name, ' ', last_name)
    WHERE first_name IS NOT NULL AND last_name IS NOT NULL
  `);

  // 3. Make column not null after population
  pgm.alterColumn("users", "full_name", { notNull: true });
};
```

## API Integration

### Authentication

All migration API endpoints require authentication. Ensure your requests include:

```bash
curl -X GET http://localhost:3000/api/migrations \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Response Formats

#### GET /api/migrations Response

```json
{
  "status": {
    "appliedMigrations": [
      "1734567890000_initial_database_setup",
      "1734567890001_episode_notes_favorites"
    ],
    "pendingMigrations": ["1734567890002_add_user_preferences"],
    "lastMigration": "1734567890001_episode_notes_favorites",
    "isUpToDate": false
  },
  "message": "Migration status retrieved successfully"
}
```

#### POST /api/migrations Response

```json
{
  "results": [
    {
      "name": "1734567890002_add_user_preferences",
      "direction": "up",
      "timestamp": "2024-12-19T10:30:00.000Z",
      "success": true
    }
  ],
  "message": "Migrations executed successfully",
  "success": true
}
```

### Error Handling

API endpoints return appropriate HTTP status codes:

- `200`: Success
- `401`: Unauthorized
- `403`: Forbidden (insufficient privileges)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

## Troubleshooting

### Common Issues

#### 1. "relation already exists" Error

**Cause**: Attempting to create a table/column that already exists.

**Solution**:

```javascript
// Use conditional creation
exports.up = (pgm) => {
  pgm.createTable(
    "users",
    {
      // table definition
    },
    {
      ifNotExists: true,
    },
  );
};
```

#### 2. Migration Timeout

**Cause**: Long-running migrations on large datasets.

**Solutions**:

- Break large migrations into smaller chunks
- Use batch processing for data migrations
- Consider maintenance windows for large changes

#### 3. Foreign Key Constraint Violations

**Cause**: Attempting to create relationships with invalid data.

**Solution**:

```javascript
exports.up = async (pgm) => {
  // Clean up invalid data first
  await pgm.sql(`
    DELETE FROM child_table 
    WHERE parent_id NOT IN (SELECT id FROM parent_table)
  `);

  // Then add constraint
  pgm.addConstraint("child_table", "fk_child_parent", {
    foreignKeys: {
      columns: "parent_id",
      references: "parent_table(id)",
    },
  });
};
```

#### 4. Permission Errors

**Cause**: Database user lacks necessary privileges.

**Solution**:

```sql
-- Grant necessary permissions
GRANT CREATE, ALTER, DROP ON DATABASE your_database TO migration_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migration_user;
```

### Debugging Tips

1. **Check Migration Status**:

   ```sql
   SELECT * FROM pgmigrations ORDER BY run_on DESC;
   ```

2. **Verify Table Structure**:

   ```sql
   \d+ table_name
   ```

3. **Check Constraints**:

   ```sql
   SELECT conname, contype FROM pg_constraint WHERE conrelid = 'table_name'::regclass;
   ```

4. **Monitor Migration Logs**:
   Check application logs for detailed error messages during migration execution.

### Getting Help

If you encounter issues not covered in this guide:

1. Check the [node-pg-migrate documentation](https://github.com/salsita/node-pg-migrate)
2. Review the migration logs in your application console
3. Examine the `pgmigrations` table for execution history
4. Consider reaching out to the development team with specific error messages and context

---

**Remember**: Always backup your database before running migrations in production environments.
