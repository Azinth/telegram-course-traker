"use client";
import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { signIn } from "next-auth/react";
import { executeRecaptcha } from "@/lib/recaptcha-client";
import RecaptchaScript from "@/components/RecaptchaScript";

export default function RegisterPage() {
  const toast = useToast();
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    number: false,
    special: false,
  });

  function evaluatePassword(pw: string) {
    if (!pw) {
      setPasswordRequirements({
        length: false,
        uppercase: false,
        number: false,
        special: false,
      });
      return null;
    }

    // Verificar requisitos individuais
    const requirements = {
      length: pw.length >= 6,
      uppercase: /[A-Z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    };
    setPasswordRequirements(requirements);

    // Calcular score baseado nos requisitos
    let score = 0;
    if (requirements.length) score++;
    if (pw.length >= 10) score++;
    if (requirements.uppercase) score++;
    if (requirements.number || requirements.special) score++;

    const labels = ["Muito fraca", "Fraca", "Ok", "Boa", "Forte"];
    const colors = [
      "bg-red-500",
      "bg-orange-500",
      "bg-yellow-500",
      "bg-green-500",
      "bg-emerald-500",
    ];
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
      // como haverá redirect, agende um toast para a próxima página
      toast.showNextPage("Usuário criado com sucesso!", "success");
      await signIn("credentials", {
        email,
        password,
        redirect: true,
        callbackUrl: "/courses",
      });
    } catch (err: any) {
      const msg = err?.message || "Falha ao registrar";
      setError(msg);
      try {
        toast.error(msg);
      } catch {}
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
          <div className="relative">
            <input
              className="w-full px-3 py-2 pr-10 rounded bg-gray-900 border border-gray-800"
              placeholder="Senha"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                const val = e.target.value;
                setPassword(val);
                setPasswordStrength(evaluatePassword(val));
              }}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>

          {password && (
            <div className="mt-2">
              {/* Barra de força da senha */}
              {passwordStrength && (
                <div className="mb-2">
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
                </div>
              )}

              {/* Lista de requisitos */}
              <div className="space-y-1">
                <div
                  className={`flex items-center text-xs ${passwordRequirements.length ? "text-green-400" : "text-gray-400"}`}
                >
                  <span className="mr-2">
                    {passwordRequirements.length ? "✓" : "○"}
                  </span>
                  Pelo menos 6 caracteres
                </div>
                <div
                  className={`flex items-center text-xs ${passwordRequirements.uppercase ? "text-green-400" : "text-gray-400"}`}
                >
                  <span className="mr-2">
                    {passwordRequirements.uppercase ? "✓" : "○"}
                  </span>
                  Pelo menos 1 letra maiúscula
                </div>
                <div
                  className={`flex items-center text-xs ${passwordRequirements.number ? "text-green-400" : "text-gray-400"}`}
                >
                  <span className="mr-2">
                    {passwordRequirements.number ? "✓" : "○"}
                  </span>
                  Pelo menos 1 número
                </div>
                <div
                  className={`flex items-center text-xs ${passwordRequirements.special ? "text-green-400" : "text-gray-400"}`}
                >
                  <span className="mr-2">
                    {passwordRequirements.special ? "✓" : "○"}
                  </span>
                  Pelo menos 1 caractere especial
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <input
            className="w-full px-3 py-2 pr-10 rounded bg-gray-900 border border-gray-800"
            placeholder="Confirmar senha"
            type={showConfirmPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
          {confirm && password && (
            <div className="mt-1">
              <div
                className={`flex items-center text-xs ${password === confirm ? "text-green-400" : "text-red-400"}`}
              >
                <span className="mr-2">{password === confirm ? "✓" : "✗"}</span>
                {password === confirm
                  ? "Senhas coincidem"
                  : "Senhas não coincidem"}
              </div>
            </div>
          )}
        </div>
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
