import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reorderCourses } from "@/lib/repos";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids))
      return NextResponse.json({ error: "ids_required" }, { status: 400 });

    const { query } = await import("@/lib/database");
    const res = await query("SELECT id FROM users WHERE email=$1", [
      session.user.email,
    ]);
    const uid = res.rows[0]?.id as string;
    if (!uid)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    await reorderCourses(uid, ids);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 400 });
  }
}
