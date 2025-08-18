// Server-side reCAPTCHA v3 verification helper
export interface RecaptchaVerificationResult {
  ok: boolean;
  score?: number;
  error?: string;
}

export async function verifyRecaptcha(
  token: string,
  opts?: { action?: string; minScore?: number },
): Promise<RecaptchaVerificationResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: "recaptcha_secret_missing" };
  }
  try {
    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = (await res.json()) as any;
    if (!data.success) return { ok: false, error: "recaptcha_failed" };
    const score: number | undefined = data.score;
    if (typeof score === "number") {
      const min = opts?.minScore ?? 0.4;
      if (score < min) return { ok: false, error: "low_score", score };
    }
    if (opts?.action && data.action && data.action !== opts.action) {
      return { ok: false, error: "action_mismatch", score };
    }
    return { ok: true, score };
  } catch (e) {
    return { ok: false, error: "recaptcha_error" };
  }
}
