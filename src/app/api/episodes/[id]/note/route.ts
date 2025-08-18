import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { upsertEpisodeNote, getEpisodeNote } from "@/lib/repos";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { query } = await import("@/lib/database");
  const res = await query("SELECT id FROM users WHERE email=$1", [
    session.user.email,
  ]);
  const userId = res.rows[0].id as string;
  const content = await getEpisodeNote(userId, params.id);
  return NextResponse.json({ content });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { query } = await import("@/lib/database");
  const res = await query("SELECT id FROM users WHERE email=$1", [
    session.user.email,
  ]);
  const userId = res.rows[0].id as string;
  const body = await req.json();
  await upsertEpisodeNote(userId, params.id, body.content || "");
  return NextResponse.json({ ok: true });
}
