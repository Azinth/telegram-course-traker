"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { executeRecaptcha } from "@/lib/recaptcha-client";
import RecaptchaScript from "@/components/RecaptchaScript";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = await executeRecaptcha("login");
      await signIn("credentials", {
        email,
        password,
        recaptchaToken: token,
        redirect: true,
        callbackUrl: "/courses",
      });
    } catch (e) {
      // opcional: exibir erro de recaptcha
    }
  }
  return (
    <div className="max-w-md mx-auto">
      <RecaptchaScript />
      <h1 className="text-2xl font-semibold mb-4">Entrar</h1>
      <form onSubmit={handleLogin} className="space-y-3">
        <input
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
          placeholder="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition">
          Entrar
        </button>
      </form>
      <p className="mt-4 text-sm opacity-80">
        Não tem conta?{" "}
        <a href="/register" className="underline">
          Registre-se
        </a>
      </p>
    </div>
  );
}
