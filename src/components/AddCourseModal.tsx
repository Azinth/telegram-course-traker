"use client";
import React, { useEffect, useMemo, useState } from "react";

export default function AddCourseModal({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (_name: string, _index: string) => Promise<void> | void;
}) {
  const [courseName, setCourseName] = useState("");
  const [courseIndex, setCourseIndex] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dedupeWithinModule, setDedupeWithinModule] = useState(true);
  const [promoteModuloHeadings, setPromoteModuloHeadings] = useState(true);
  const [preview, setPreview] = useState<null | {
    modules: Array<{
      title: string;
      total: number;
      unique: number;
      duplicates: Array<{ tag: string; count: number }>;
      tags: string[];
    }>;
    existing: Array<{
      tag: string;
      course_title: string;
      module_title: string;
      count: number;
    }>;
    summary: {
      modules: number;
      episodes: number;
      uniqueTags: number;
      hasDuplicatesWithin: boolean;
      duplicatesAcrossLibrary: number;
    };
  }>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Nota: evitamos early-return para manter a contagem/ordem de hooks estável entre renders.

  const handleSave = async () => {
    setError(null);
    if (!courseName || !courseIndex) {
      setError("Por favor, preencha o nome e o índice do curso.");
      return;
    }
    try {
      setSaving(true);
      const maybePromise = onSave(
        courseName,
        JSON.stringify({
          index: courseIndex,
          options: { dedupeWithinModule, promoteModuloHeadings },
        }) as any,
      );
      if (maybePromise && typeof (maybePromise as any).then === "function") {
        await maybePromise;
      }
      setCourseName("");
      setCourseIndex("");
      onClose();
    } catch (e: any) {
      console.error("Falha ao salvar curso:", e);
      setError(e?.message || "Não foi possível criar o curso.");
    } finally {
      setSaving(false);
    }
  };

  // Build and fetch preview (server-aware for existing tags)
  // Debounce quando o índice muda
  useEffect(() => {
    let ignore = false;
    async function run() {
      const trimmed = courseIndex.trim();
      if (!trimmed) {
        setPreview(null);
        return;
      }
      try {
        setLoadingPreview(true);
        const res = await fetch("/api/courses/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            index: trimmed,
            options: { promoteModuloHeadings },
          }),
        });
        if (!res.ok) throw new Error("Falha ao gerar preview");
        const j = await res.json();
        if (!ignore) setPreview(j);
      } catch (e) {
        if (!ignore) setPreview(null);
      } finally {
        if (!ignore) setLoadingPreview(false);
      }
    }
    // debounce leve
    const t = setTimeout(run, 300);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [courseIndex, promoteModuloHeadings]);

  // Atualização imediata quando apenas o toggle muda (sem debounce)
  useEffect(() => {
    let ignore = false;
    async function runImmediate() {
      const trimmed = courseIndex.trim();
      if (!trimmed) return;
      try {
        setLoadingPreview(true);
        const res = await fetch("/api/courses/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            index: trimmed,
            options: { promoteModuloHeadings },
          }),
        });
        if (!res.ok) throw new Error("Falha ao gerar preview");
        const j = await res.json();
        if (!ignore) setPreview(j);
      } catch (e) {
        if (!ignore) setPreview(null);
      } finally {
        if (!ignore) setLoadingPreview(false);
      }
    }
    runImmediate();
    return () => {
      ignore = true;
    };
  }, [promoteModuloHeadings]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl text-white">
            <h2 className="text-2xl font-bold mb-4">Adicionar Novo Curso</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nome completo do curso"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Cole o índice do curso aqui (com os módulos e hashtags)..."
                value={courseIndex}
                onChange={(e) => setCourseIndex(e.target.value)}
                rows={10}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-green-600"
                    checked={dedupeWithinModule}
                    onChange={(e) => setDedupeWithinModule(e.target.checked)}
                  />
                  Remover duplicatas no mesmo módulo (recomendado)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={promoteModuloHeadings}
                    onChange={(e) => setPromoteModuloHeadings(e.target.checked)}
                  />
                  Promover “Módulo X …” a módulos
                </label>
              </div>
              <div className="bg-gray-900/50 rounded border border-gray-700 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Pré-visualização</h3>
                  {loadingPreview && (
                    <span className="text-xs text-gray-400">Analisando…</span>
                  )}
                </div>
                {preview ? (
                  <div className="mt-2 space-y-2 max-h-60 overflow-auto pr-1">
                    <div className="text-xs text-gray-400">
                      {preview.summary.modules} módulos •{" "}
                      {preview.summary.episodes} aulas •{" "}
                      {preview.summary.uniqueTags} tags únicas
                      {preview.summary.hasDuplicatesWithin
                        ? " • duplicatas detectadas"
                        : ""}
                      {preview.summary.duplicatesAcrossLibrary
                        ? ` • ${preview.summary.duplicatesAcrossLibrary} ocorrências na sua biblioteca`
                        : ""}
                    </div>
                    {preview.modules.map((m, i) => (
                      <div key={i} className="border-t border-gray-800 pt-2">
                        <div className="text-sm font-medium">{m.title}</div>
                        <div className="text-xs text-gray-400 mb-1">
                          {m.unique}/{m.total} únicas
                          {m.duplicates.length
                            ? ` • duplicatas: ${m.duplicates.map((d) => `${d.tag}×${d.count}`).join(", ")}`
                            : ""}
                        </div>
                        <div className="flex flex-wrap gap-1 text-[11px] text-gray-300 font-mono">
                          {m.tags.map((t, idx) => (
                            <span
                              key={idx}
                              className="px-1 py-0.5 rounded bg-gray-800 border border-gray-700"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-500">
                    Cole o índice para visualizar uma análise prévia.
                  </div>
                )}
              </div>
              {error && (
                <div
                  className="text-red-400 text-sm whitespace-pre-wrap"
                  role="alert"
                >
                  {error}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-2 rounded font-semibold ${
                  saving
                    ? "bg-blue-600/60 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {saving ? "Salvando..." : "Salvar Curso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
