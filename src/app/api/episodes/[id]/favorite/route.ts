import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { toggleFavoriteEpisode, isEpisodeFavorited } from "@/lib/repos";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { query } = await import("@/lib/database");
  const res = await query("SELECT id FROM users WHERE email=$1", [
    session.user.email,
  ]);
  const userId = res.rows[0].id as string;
  const favorited = await isEpisodeFavorited(userId, params.id);
  return NextResponse.json({ favorited });
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { query } = await import("@/lib/database");
  const res = await query("SELECT id FROM users WHERE email=$1", [
    session.user.email,
  ]);
  const userId = res.rows[0].id as string;
  const result = await toggleFavoriteEpisode(userId, params.id);
  return NextResponse.json(result);
}
