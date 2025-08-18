import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser } from "@/lib/repos";
import { verifyRecaptcha } from "@/lib/recaptcha";
import bcrypt from "bcryptjs";
import { query } from "@/lib/database";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z
    .string()
    .min(6)
    .regex(
      /^(?=.*[A-Z])(?=.*\d).+$/,
      "Senha deve conter ao menos uma letra maiúscula e um número",
    ),
  recaptchaToken: z.string().min(10),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const rec = await verifyRecaptcha(data.recaptchaToken, {
      action: "register",
      minScore: 0.4,
    });
    if (!rec.ok)
      return NextResponse.json(
        { error: "Falha na verificação reCAPTCHA" },
        { status: 400 },
      );
    const exists = await query("SELECT 1 FROM users WHERE email=$1", [
      data.email,
    ]);
    if (exists.rowCount)
      return NextResponse.json(
        { error: "Email já cadastrado" },
        { status: 409 },
      );
    const hash = await bcrypt.hash(data.password, 10);
    const user = await createUser({
      name: data.name,
      email: data.email,
      passwordHash: hash,
    });
    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 400 });
  }
}
