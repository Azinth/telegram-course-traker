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

## Notes

- `stop` closes the current session and sets `completed_at` on the course.
- Progress = % of completed episodes.
- Total time = sum of `(ended_at - started_at)` for the course's sessions.
- Basic validation with Zod.
- Simple CSS with Tailwind.

## Next Steps (suggestions)

- Import real titles/links by tag (if an external mapping exists).
- Display time per module and per day.
- Export a CSV report.
- Notes per episode.
- Adapt for SQLite/Prisma/Drizzle, if preferred.
