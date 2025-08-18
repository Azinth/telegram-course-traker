// Client-side helper to execute reCAPTCHA v3
export async function executeRecaptcha(action: string): Promise<string> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) throw new Error("Site key ausente");
  if (typeof window === "undefined")
    throw new Error("Execução client-side apenas");
  const grecaptcha: any = (window as any).grecaptcha;
  if (!grecaptcha) throw new Error("reCAPTCHA não carregado");
  return new Promise((resolve, reject) => {
    grecaptcha.ready(() => {
      grecaptcha
        .execute(siteKey, { action })
        .then((token: string) => resolve(token))
        .catch((err: any) => reject(err));
    });
  });
}
