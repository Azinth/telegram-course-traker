import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCourseDetail } from "@/lib/repos";
import { deleteCourse } from "@/lib/repos";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = await userId(session.user.email);
  const data = await getCourseDetail(uid, params.id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = await userId(session.user.email);
  const ok = await deleteCourse(uid, params.id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

async function userId(email: string): Promise<string> {
  const { query } = await import("@/lib/database");
  const res = await query("SELECT id FROM users WHERE email=$1", [email]);
  return res.rows[0].id as string;
}
