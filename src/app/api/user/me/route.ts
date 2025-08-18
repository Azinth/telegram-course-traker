import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/database";

export async function GET(_req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await query(
      "SELECT id, name, email FROM users WHERE email=$1",
      [session.user.email],
    );
    const user = res.rows[0];
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}
