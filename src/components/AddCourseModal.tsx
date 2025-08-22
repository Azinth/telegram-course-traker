"use client";
import React, { useState } from "react";

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

  if (!isOpen) return null;

  const handleSave = async () => {
    setError(null);
    if (!courseName || !courseIndex) {
      setError("Por favor, preencha o nome e o índice do curso.");
      return;
    }
    try {
      setSaving(true);
      const maybePromise = onSave(courseName, courseIndex);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
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
  );
}
