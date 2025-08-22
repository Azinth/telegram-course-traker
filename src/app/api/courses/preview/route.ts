import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ index: z.string().min(1) });

async function userId(email: string): Promise<string> {
  const { query } = await import("@/lib/database");
  const res = await query("SELECT id FROM users WHERE email=$1", [email]);
  return res.rows[0].id as string;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json();
    const { index } = schema.parse(body);
    const { parseIndex, TAG_REGEX } = await import("@/lib/parser");
    const parsed = parseIndex(index);

    // duplicates within the pasted index (per module)
    const modules = parsed.modules.map((m) => {
      const counts: Record<string, number> = {};
      for (const t of m.tags) counts[t] = (counts[t] || 0) + 1;
      const duplicates = Object.entries(counts)
        .filter(([_, c]) => c > 1)
        .map(([tag, c]) => ({ tag, count: c }));
      return {
        title: m.title || "Sem Título",
        total: m.tags.length,
        unique: Object.keys(counts).length,
        duplicates,
        tags: m.tags,
      };
    });

    const allTags = Array.from(new Set(parsed.modules.flatMap((m) => m.tags)));

    // check duplicates across user's library
    const uid = await userId(session.user.email);
    const { query } = await import("@/lib/database");
    let existing: Array<{
      tag: string;
      course_title: string;
      module_title: string;
      count: number;
    }> = [];
    if (allTags.length) {
      const { rows } = await query(
        `SELECT e.tag, c.title as course_title, m.title as module_title, COUNT(*)::int as count
         FROM episodes e
         JOIN modules m ON e.module_id=m.id
         JOIN courses c ON m.course_id=c.id
         WHERE c.user_id=$1 AND e.tag = ANY($2)
         GROUP BY e.tag, c.title, m.title
         ORDER BY e.tag` as any,
        [uid, allTags],
      );
      existing = rows;
    }

    const summary = {
      modules: modules.length,
      episodes: parsed.modules.reduce((acc, m) => acc + m.tags.length, 0),
      uniqueTags: allTags.length,
      hasDuplicatesWithin: modules.some((m) => m.duplicates.length > 0),
      duplicatesAcrossLibrary: existing.length,
    };

    return NextResponse.json({ modules, existing, summary });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro" }, { status: 400 });
  }
}
