"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { executeRecaptcha } from "@/lib/recaptcha-client";
import RecaptchaScript from "@/components/RecaptchaScript";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<null | {
    score: number; // 0-4
    label: string;
    color: string;
  }>(null);

  function evaluatePassword(pw: string) {
    if (!pw) return null;
    // critérios simples: tamanho, tipos de caracteres
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw) || /[0-9]/.test(pw)) score++;
    const labels = ["Muito fraca", "Fraca", "Ok", "Boa", "Forte"];
    const colors = [
      "bg-red-500",
      "bg-orange-500",
      "bg-yellow-500",
      "bg-green-500",
      "bg-emerald-500",
    ]; // tailwind classes
    return { score, label: labels[score], color: colors[score] };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (password !== confirm) {
      setError("Senhas não conferem");
      return;
    }
    if (password.length < 6) {
      setError("Senha deve ter ao menos 6 caracteres");
      return;
    }
    if (!/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError("Senha precisa de ao menos 1 maiúscula e 1 número");
      return;
    }
    if (name.trim().length < 2) {
      setError("Nome muito curto");
      return;
    }
    setLoading(true);
    try {
      const recaptchaToken = await executeRecaptcha("register");
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, recaptchaToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao registrar");
      setSuccess(true);
      // opcional: login automático
      await signIn("credentials", {
        email,
        password,
        redirect: true,
        callbackUrl: "/courses",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <RecaptchaScript />
      <h1 className="text-2xl font-semibold mb-4">Criar conta</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <input
            className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
            placeholder="Senha"
            type="password"
            value={password}
            onChange={(e) => {
              const val = e.target.value;
              setPassword(val);
              setPasswordStrength(evaluatePassword(val));
            }}
          />
          {passwordStrength && (
            <div className="mt-1">
              <div className="h-2 w-full bg-gray-800 rounded overflow-hidden">
                <div
                  className={`${passwordStrength.color} h-2 transition-all`}
                  style={{
                    width: `${((passwordStrength.score + 1) / 5) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs mt-1 opacity-80">
                Força: {passwordStrength.label}
              </p>
              <p className="text-[10px] leading-snug mt-1 opacity-60">
                Dicas: use 10+ caracteres, inclua maiúsculas, números e
                símbolos.
              </p>
            </div>
          )}
        </div>
        <input
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
          placeholder="Confirmar senha"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">Conta criada!</p>}
        <button
          disabled={loading}
          className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Registrar"}
        </button>
      </form>
      <p className="mt-4 text-sm opacity-80">
        Já tem conta?{" "}
        <a className="underline" href="/login">
          Entrar
        </a>
      </p>
    </div>
  );
}
