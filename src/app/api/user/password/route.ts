import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { updateUserPassword } from "@/lib/repos";
import { query } from "@/lib/database";

const schema = z.object({
  currentPassword: z.string().min(1),
  password: z
    .string()
    .min(6)
    .regex(
      /^(?=.*[A-Z])(?=.*\d).*$/,
      "Senha deve conter ao menos uma letra maiúscula e um número",
    ),
});

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { currentPassword, password } = schema.parse(body);
    const res = await query(
      "SELECT id, password_hash FROM users WHERE email=$1",
      [session.user.email],
    );
    const user = res.rows[0];
    const userId = user?.id;
    if (!userId)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok)
      return NextResponse.json(
        { error: "Senha atual incorreta" },
        { status: 401 },
      );
    const hash = await bcrypt.hash(password, 10);
    await updateUserPassword(userId, hash);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 400 });
  }
}
