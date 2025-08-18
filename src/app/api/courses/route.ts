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
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const data = createSchema.parse(body);
  const uid = await userId(session.user.email);
  const c = await createCourseFromIndex({
    userId: uid,
    title: data.title,
    rawIndex: data.index,
  });
  return NextResponse.json({ id: c.id });
}
