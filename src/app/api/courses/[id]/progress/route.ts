import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { toggleEpisode } from "@/lib/repos";
import { z } from "zod";

const schema = z.object({
  episodeId: z.string().min(5),
  completed: z.boolean(),
});

export async function POST(
  req: Request,
  { params: _params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { episodeId, completed } = schema.parse(await req.json());
  const uid = await userId(session.user.email);
  await toggleEpisode(uid, episodeId, completed);
  return NextResponse.json({ ok: true });
}

async function userId(email: string): Promise<string> {
  const { query } = await import("@/lib/database");
  const res = await query("SELECT id FROM users WHERE email=$1", [email]);
  return res.rows[0].id as string;
}
