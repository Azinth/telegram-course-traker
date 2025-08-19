# Course Tracker (Next.js + TS)

An app to manage courses with a Telegram-style index (#D001 etc.), lesson checklists, and time tracking (start/pause/stop).

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- TailwindCSS
- NextAuth (Credentials, JWT)
- Postgres via `pg` (simple DAL) — can be adapted for other databases by maintaining the interfaces

## Quick Setup

1.  **Clone & install**

    ```bash
    npm i
    cp .env.example .env.development
    ```

2.  **Run Postgres (optional)**

    ```bash
    docker compose -f docker/compose.yaml --env-file .env.development up -d
    ```

3.  **Initialize schema**

    ```bash
    npm run db:init
    ```

4.  **Create user**

    - Make a POST request to `http://localhost:3000/api/register`:
      ```json
      {
        "name": "Gabriel",
        "email": "gabriel@example.com",
        "password": "123456"
      }
      ```

5.  **Run**
    ```bash
    npm run dev
    # open http://localhost:3000
    ```

## Workflow

- Log in with email/password (NextAuth).
- Create a course at **/courses/new** by pasting the index (exactly as it appears in Telegram, with lines starting with `= Module ...` and the `#tags`).
- On the course screen: check off episodes and control the timer (start/pause/stop). The total time is the sum of all completed sessions.

## Database (Postgres)

- Tables: `users`, `courses`, `modules`, `episodes`, `user_episode_progress`, `course_sessions`.
- IDs are UUIDs (strings) generated in the app → this makes it easier to port to another DB.
- For a different database, re-implement `src/lib/database.ts` and maintain the same `query(q, params)` API.

### Database Migrations

This project uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for database schema management.

#### Available Migration Scripts

```bash
# Run all pending migrations
npm run migrate:up

# Rollback the last migration
npm run migrate:down

# Create a new migration file
npm run migrate:create <migration-name>

# Redo the last migration (down then up)
npm run migrate:redo

# Legacy database initialization (deprecated)
npm run db:init
```

#### Migration API Endpoints

The application provides HTTP endpoints for migration management:

**GET /api/migrations**

- Returns the current migration status
- Shows applied and pending migrations
- Requires authentication

**POST /api/migrations**

- Executes all pending migrations
- Returns detailed results of migration execution
- Requires authentication and admin privileges

Example API usage:

```bash
# Check migration status
curl -X GET http://localhost:3000/api/migrations \
  -H "Authorization: Bearer <your-token>"

# Run pending migrations
curl -X POST http://localhost:3000/api/migrations \
  -H "Authorization: Bearer <your-token>"
```

#### Migration Troubleshooting

**Common Issues:**

1. **Database connection errors**

   - Verify `DATABASE_URL` in your `.env.development` file
   - Ensure PostgreSQL is running
   - Check database credentials and permissions

2. **Migration fails with "relation already exists"**

   - This usually happens when mixing legacy and new migration systems
   - Check if tables were created by the old `db:init` script
   - Consider manually marking migrations as applied if tables exist

3. **Permission denied errors**

   - Ensure your database user has CREATE, ALTER, and DROP privileges
   - For production, use a dedicated migration user with appropriate permissions

4. **Migration timeout**

   - Large migrations may timeout on slow connections
   - Consider breaking large migrations into smaller chunks
   - Increase timeout settings if necessary

5. **Rollback failures**
   - Ensure your migration files have proper `down` functions
   - Some operations (like dropping columns with data) cannot be automatically rolled back
   - Always backup your database before running migrations in production

**Getting Help:**

- Check the migration logs in your application console
- Review the `pgmigrations` table to see which migrations have been applied
- Use `npm run migrate:create` to generate properly formatted migration files
- See [docs/MIGRATIONS.md](docs/MIGRATIONS.md) for comprehensive migration workflow documentation

## Notes

- `stop` closes the current session and sets `completed_at` on the course.
- Progress = % of completed episodes.
- Total time = sum of `(ended_at - started_at)` for the course's sessions.
- Basic validation with Zod.
- Simple CSS with Tailwind.
