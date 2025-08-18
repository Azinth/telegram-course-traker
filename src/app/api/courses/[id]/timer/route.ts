import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  markCourseCompleted,
  pauseOrStopSession,
  startSession,
} from "@/lib/repos";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["start", "pause", "stop"]),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { action } = schema.parse(await req.json());
  const uid = await userId(session.user.email);

  if (action === "start") {
    await startSession(uid, params.id);
  } else {
    await pauseOrStopSession(uid, params.id);
    if (action === "stop") {
      await markCourseCompleted(uid, params.id);
    }
  }
  return NextResponse.json({ ok: true });
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = await userId(session.user.email);

  // verificar se existe sessão ativa
  const { query } = await import("@/lib/database");
  const r = await query(
    `SELECT id, EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))::bigint AS seconds, ended_at IS NULL AS active FROM course_sessions WHERE user_id=$1 AND course_id=$2 ORDER BY started_at DESC LIMIT 1`,
    [uid, params.id],
  );
  if (!r.rows.length) return NextResponse.json({ active: false, seconds: 0 });
  const row = r.rows[0];
  return NextResponse.json({
    active: !!row.active,
    seconds: Number(row.seconds || 0),
  });
}

async function userId(email: string): Promise<string> {
  const { query } = await import("@/lib/database");
  const res = await query("SELECT id FROM users WHERE email=$1", [email]);
  return res.rows[0].id as string;
}
