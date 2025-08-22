import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCourseFromIndex, listCoursesWithProgress } from "@/lib/repos";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(3),
  index: z.string().min(3),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // fetch user id
  // minimal query to resolve id
  return NextResponse.json(
    await listCoursesWithProgress(await userId(session.user.email)),
  );
}

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
    const data = createSchema.parse(body);

    // validate parsed tags before attempting inserts so we can return
    // a friendly error when tags already exist (episodes.tag is UNIQUE)
    const { parseIndex } = await import("@/lib/parser");
    const parsed = parseIndex(data.index);
    const tags = parsed.modules.flatMap((m) => m.tags);
    if (!tags.length)
      return NextResponse.json(
        { error: "Índice inválido: sem tags encontradas" },
        { status: 400 },
      );

    // A partir de agora, a unicidade é por módulo (module_id, tag), então não bloqueamos
    // antecipadamente. Conflitos serão ignorados na inserção (upsert) e o restante será criado.

    const uid = await userId(session.user.email);
    const c = await createCourseFromIndex({
      userId: uid,
      title: data.title,
      rawIndex: data.index,
    });
    return NextResponse.json({ id: c.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro" }, { status: 400 });
  }
}
