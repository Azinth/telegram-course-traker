"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCourse(){
  const [title, setTitle] = useState("");
  const [indexText, setIndexText] = useState("");
  const [error, setError] = useState<string|null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent){
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, index: indexText })
    });
    if (!res.ok) {
      const j = await res.json().catch(()=>({error:"Erro"}));
      setError(j.error || "Erro");
      return;
    }
    const j = await res.json();
    router.push(`/courses/${j.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Novo curso</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800" placeholder="Título do curso" value={title} onChange={e=>setTitle(e.target.value)} />
        <textarea className="w-full min-h-[240px] px-3 py-2 rounded bg-gray-900 border border-gray-800" placeholder="Cole o índice com os módulos e #tags" value={indexText} onChange={e=>setIndexText(e.target.value)} />
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button className="px-4 py-2 rounded bg-white/10 hover:bg-white/20">Criar</button>
      </form>
    </div>
  );
}
