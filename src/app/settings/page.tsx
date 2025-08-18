"use client";
import { useState, useEffect } from "react";
import { executeRecaptcha } from "@/lib/recaptcha-client";
import RecaptchaScript from "@/components/RecaptchaScript";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<null | {
    score: number;
    label: string;
    color: string;
  }>(null);

  function evaluatePassword(pw: string) {
    if (!pw) return null;
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
    ];
    return { score, label: labels[score], color: colors[score] };
  }
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function updateName(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (name.trim().length < 2) return setMsg("Nome muito curto");
    setShowNameConfirm(true);
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password !== confirm) return setMsg("Senhas não conferem");
    if (password.length < 6) return setMsg("Senha muito curta");
    if (!/[A-Z]/.test(password) || !/\d/.test(password))
      return setMsg("Senha precisa de ao menos 1 maiúscula e 1 número");
    // abrir modal de confirmação
    setShowPasswordConfirm(true);
  }

  async function performUpdateName() {
    setShowNameConfirm(false);
    setLoading(true);
    setMsg(null);
    try {
      const recaptchaToken = await executeRecaptcha("update_name");
      const res = await fetch("/api/user/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, recaptchaToken }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro");
      setMsg("Nome atualizado");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function performUpdatePassword() {
    setShowPasswordConfirm(false);
    setLoading(true);
    setMsg(null);
    try {
      const recaptchaToken = await executeRecaptcha("change_password");
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, password, recaptchaToken }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erro");
      setMsg("Senha alterada");
      setPassword("");
      setConfirm("");
      setCurrentPassword("");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/user/me");
        if (!res.ok) return;
        const j = await res.json();
        if (!mounted) return;
        if (j?.ok) {
          if (j.user?.name) setName(j.user.name);
          if (j.user?.email) setEmail(j.user.email);
        }
      } catch (e) {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-lg mx-auto">
      <RecaptchaScript />
      <h1 className="text-2xl font-semibold mb-6">Configurações</h1>
      <form onSubmit={updateName} className="space-y-3 mb-6">
        <label className="text-sm opacity-80">Nome</label>
        <input
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
        />
        <button
          disabled={loading}
          className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
        >
          Salvar nome
        </button>
      </form>
      <form onSubmit={updatePassword} className="space-y-3">
        <label className="text-sm opacity-80">Email</label>
        <input
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
          value={email}
          readOnly
        />
        <label className="text-sm opacity-80">Senha atual</label>
        <input
          type="password"
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Senha atual"
        />
        <label className="text-sm opacity-80">Nova senha</label>
        <input
          type="password"
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
          value={password}
          onChange={(e) => {
            const v = e.target.value;
            setPassword(v);
            setPasswordStrength(evaluatePassword(v));
          }}
          placeholder="Nova senha"
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
          </div>
        )}
        <input
          type="password"
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmar senha"
        />
        <button
          disabled={loading}
          className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
        >
          Trocar senha
        </button>
      </form>
      {msg && <p className="mt-4 text-sm">{msg}</p>}

      {/* Confirmation modals */}
      {showNameConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 p-6 rounded shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Confirmar alteração</h3>
            <p className="mb-4">Deseja alterar seu nome para "{name}"?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowNameConfirm(false)}
                className="px-3 py-2 bg-gray-700 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={performUpdateName}
                className="px-3 py-2 bg-blue-600 rounded"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {showPasswordConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 p-6 rounded shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">
              Confirmar alteração de senha
            </h3>
            <p className="mb-4">Deseja realmente alterar sua senha?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPasswordConfirm(false)}
                className="px-3 py-2 bg-gray-700 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={performUpdatePassword}
                className="px-3 py-2 bg-blue-600 rounded"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {msg && <p className="mt-4 text-sm">{msg}</p>}
    </div>
  );
}
