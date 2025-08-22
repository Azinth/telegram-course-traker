import { query } from "@/lib/database";
import { v4 as uuid } from "uuid";
import { parseIndex } from "@/lib/parser";

export async function createUser({
  name,
  email,
  passwordHash,
}: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  const id = uuid();
  await query(
    "INSERT INTO users (id, name, email, password_hash) VALUES ($1,$2,$3,$4)",
    [id, name, email, passwordHash],
  );
  return { id, name, email };
}

export async function createCourseFromIndex({
  userId,
  title,
  rawIndex,
}: {
  userId: string;
  title: string;
  rawIndex: string;
}) {
  const courseId = uuid();
  await query(
    "INSERT INTO courses (id, user_id, title, raw_index) VALUES ($1,$2,$3,$4)",
    [courseId, userId, title, rawIndex],
  );
  const parsed = parseIndex(rawIndex);
  let modulePos = 1;
  for (const m of parsed.modules) {
    const moduleId = uuid();
    await query(
      "INSERT INTO modules (id, course_id, title, position) VALUES ($1,$2,$3,$4)",
      [moduleId, courseId, m.title, modulePos++],
    );
    let epPos = 1;
    for (const tag of m.tags) {
      const epId = uuid();
      const epTitle = `Aula ${tag}`;
      // Insere episódio ignorando conflito por (module_id, tag) e retorna o id real
      const { rows: epRows } = await query(
        `INSERT INTO episodes (id, module_id, tag, title, position)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (module_id, tag) DO UPDATE SET title=EXCLUDED.title
         RETURNING id`,
        [epId, moduleId, tag, epTitle, epPos++],
      );
      const realEpId = epRows[0]?.id || epId;
      await query(
        "INSERT INTO user_episode_progress (user_id, episode_id, completed) VALUES ($1,$2,$3) ON CONFLICT (user_id, episode_id) DO NOTHING",
        [userId, realEpId, false],
      );
    }
  }
  return { id: courseId };
}

export async function listCoursesWithProgress(userId: string) {
  const courses = (
    await query(
      "SELECT id, title, created_at, completed_at FROM courses WHERE user_id=$1 ORDER BY created_at DESC",
      [userId],
    )
  ).rows;

  for (const c of courses) {
    const total = (
      await query(
        `SELECT COUNT(*)::int AS total FROM episodes e JOIN modules m ON e.module_id=m.id WHERE m.course_id=$1`,
        [c.id],
      )
    ).rows[0].total;
    const done = (
      await query(
        `SELECT COUNT(*)::int AS done FROM user_episode_progress p JOIN episodes e ON p.episode_id=e.id JOIN modules m ON e.module_id=m.id WHERE p.user_id=$1 AND m.course_id=$2 AND p.completed=TRUE`,
        [userId, c.id],
      )
    ).rows[0].done;

    // inclui sessões ativas (ended_at pode ser NULL) somando (COALESCE(ended_at, NOW()) - started_at)
    const time = (
      await query(
        `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))),0)::bigint AS seconds FROM course_sessions WHERE user_id=$1 AND course_id=$2`,
        [userId, c.id],
      )
    ).rows[0].seconds;
    c.progress = total ? Math.round((done / total) * 100) : 0;
    // expose raw counts so UI components that don't have full modules can still show progress
    c.total_episodes = Number(total || 0);
    c.done_episodes = Number(done || 0);
    c.total_seconds = Number(time || 0);
  }
  return courses;
}

export async function getCourseDetail(userId: string, courseId: string) {
  const course = (
    await query(
      "SELECT id, title, created_at, completed_at FROM courses WHERE id=$1 AND user_id=$2",
      [courseId, userId],
    )
  ).rows[0];
  if (!course) return null;
  const modules = (
    await query(
      "SELECT id, title, position FROM modules WHERE course_id=$1 ORDER BY position ASC",
      [courseId],
    )
  ).rows;
  for (const m of modules) {
    const episodes = (
      await query(
        `
      SELECT e.id, e.tag, e.title, e.position,
        COALESCE(p.completed,false) AS completed,
        COALESCE(n.content, '') AS note_content,
        CASE WHEN f.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS favorited
      FROM episodes e
      LEFT JOIN user_episode_progress p ON p.episode_id=e.id AND p.user_id=$1
      LEFT JOIN episode_notes n ON n.episode_id=e.id AND n.user_id=$1
      LEFT JOIN episode_favorites f ON f.episode_id=e.id AND f.user_id=$1
      WHERE e.module_id=$2
      ORDER BY e.position ASC
    `,
        [userId, m.id],
      )
    ).rows;
    m.episodes = episodes;
  }
  // incluir sessões ativas no total apresentado ao cliente
  const time = (
    await query(
      `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))),0)::bigint AS seconds FROM course_sessions WHERE user_id=$1 AND course_id=$2`,
      [userId, courseId],
    )
  ).rows[0].seconds;
  course.modules = modules;
  course.total_seconds = Number(time || 0);
  return course;
}

// Notes & Favorites
export async function upsertEpisodeNote(
  userId: string,
  episodeId: string,
  content: string,
) {
  const id = uuid();
  await query(
    `INSERT INTO episode_notes (id, user_id, episode_id, content)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, episode_id)
     DO UPDATE SET content=EXCLUDED.content, updated_at=NOW()`,
    [id, userId, episodeId, content],
  );
}

export async function getEpisodeNote(userId: string, episodeId: string) {
  const { rows } = await query(
    `SELECT content FROM episode_notes WHERE user_id=$1 AND episode_id=$2`,
    [userId, episodeId],
  );
  return rows[0]?.content || null;
}

export async function toggleFavoriteEpisode(userId: string, episodeId: string) {
  const { rows } = await query(
    `SELECT 1 FROM episode_favorites WHERE user_id=$1 AND episode_id=$2`,
    [userId, episodeId],
  );
  if (rows.length) {
    await query(
      `DELETE FROM episode_favorites WHERE user_id=$1 AND episode_id=$2`,
      [userId, episodeId],
    );
    return { favorited: false };
  } else {
    await query(
      `INSERT INTO episode_favorites (user_id, episode_id) VALUES ($1,$2)`,
      [userId, episodeId],
    );
    return { favorited: true };
  }
}

export async function isEpisodeFavorited(userId: string, episodeId: string) {
  const { rows } = await query(
    `SELECT 1 FROM episode_favorites WHERE user_id=$1 AND episode_id=$2`,
    [userId, episodeId],
  );
  return rows.length > 0;
}

export async function toggleEpisode(
  userId: string,
  episodeId: string,
  completed: boolean,
) {
  await query(
    `
    INSERT INTO user_episode_progress (user_id, episode_id, completed, completed_at)
    VALUES ($1,$2,$3, CASE WHEN $3 THEN NOW() ELSE NULL END)
    ON CONFLICT (user_id, episode_id) DO UPDATE SET completed=$3, completed_at=CASE WHEN $3 THEN NOW() ELSE NULL END
  `,
    [userId, episodeId, completed],
  );
}

export async function startSession(userId: string, courseId: string) {
  const { rows } = await query(
    `SELECT id FROM course_sessions WHERE user_id=$1 AND course_id=$2 AND ended_at IS NULL LIMIT 1`,
    [userId, courseId],
  );
  if (rows.length) return rows[0];
  const { rows: r2 } = await query(
    `INSERT INTO course_sessions (id, user_id, course_id, started_at) VALUES ($1,$2,$3, NOW()) RETURNING id`,
    [uuid(), userId, courseId],
  );
  return r2[0];
}

export async function pauseOrStopSession(userId: string, courseId: string) {
  await query(
    `UPDATE course_sessions SET ended_at=NOW() WHERE user_id=$1 AND course_id=$2 AND ended_at IS NULL`,
    [userId, courseId],
  );
}

export async function markCourseCompleted(userId: string, courseId: string) {
  await query(
    `UPDATE courses SET completed_at=NOW() WHERE id=$1 AND user_id=$2`,
    [courseId, userId],
  );
}

export async function updateUserName(userId: string, name: string) {
  await query(`UPDATE users SET name=$1 WHERE id=$2`, [name, userId]);
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  await query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [
    passwordHash,
    userId,
  ]);
}
