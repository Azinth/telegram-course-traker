import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  index: z.string().min(1),
  options: z
    .object({ promoteModuloHeadings: z.boolean().optional() })
    .optional(),
});

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
    const { index, options } = schema.parse(body);
    const { parseIndexHierarchical } = await import("@/lib/parser");
    const parsed = parseIndexHierarchical(index, options);

    // duplicates within the pasted index (per module)
    const modules = parsed.modules.map((m) => {
      const counts: Record<string, number> = {};
      const flatTags = m.sections.flatMap((s) => s.tags);
      for (const t of flatTags) counts[t] = (counts[t] || 0) + 1;
      const duplicates = Object.entries(counts)
        .filter(([_, c]) => c > 1)
        .map(([tag, c]) => ({ tag, count: c }));
      return {
        title: m.title || "Sem Título",
        total: flatTags.length,
        unique: Object.keys(counts).length,
        duplicates,
        tags: flatTags,
      };
    });

    const allTags = Array.from(new Set(modules.flatMap((m) => m.tags)));

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
      episodes: modules.reduce((acc, m) => acc + m.total, 0),
      uniqueTags: allTags.length,
      hasDuplicatesWithin: modules.some((m) => m.duplicates.length > 0),
      duplicatesAcrossLibrary: existing.length,
    };

    return NextResponse.json({ modules, existing, summary });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro" }, { status: 400 });
  }
}
