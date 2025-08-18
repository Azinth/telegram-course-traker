import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { updateUserName } from "@/lib/repos";
import { query } from "@/lib/database";
import { verifyRecaptcha } from "@/lib/recaptcha";

const schema = z.object({
  name: z.string().min(2),
  recaptchaToken: z.string().min(10),
});

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { name, recaptchaToken } = schema.parse(body);
    const rec = await verifyRecaptcha(recaptchaToken, {
      action: "update_name",
      minScore: 0.4,
    });
    if (!rec.ok)
      return NextResponse.json(
        { error: "Falha na verificação reCAPTCHA" },
        { status: 400 },
      );
    // get user id
    const res = await query("SELECT id FROM users WHERE email=$1", [
      session.user.email,
    ]);
    const userId = res.rows[0]?.id;
    if (!userId)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    await updateUserName(userId, name);
    return NextResponse.json({ ok: true, name });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 400 });
  }
}
