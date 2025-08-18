"use client";
import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  episodeId: string | null;
  open: boolean;
  onClose: () => void;
  initialContent?: string | null;
  onSaved?: (_content: string) => void;
}
export default function EpisodeNoteModal({
  episodeId,
  open,
  onClose,
  initialContent,
  onSaved,
}: Props) {
  const [content, setContent] = useState(initialContent || "");
  const [editMode, setEditMode] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && episodeId) {
      if (initialContent != null) {
        setContent(initialContent);
        setEditMode(!initialContent);
        return;
      }
      setLoading(true);
      fetch(`/api/episodes/${episodeId}/note`)
        .then((r) => r.json())
        .then((j) => {
          setContent(j.content || "");
          setEditMode(!j.content);
        })
        .finally(() => setLoading(false));
    }
  }, [open, episodeId, initialContent]);

  async function save() {
    if (!episodeId) return;
    setLoading(true);
    await fetch(`/api/episodes/${episodeId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setLoading(false);
    setEditMode(false);
    try {
      if (onSaved) onSaved(content);
    } catch (e) {}
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="font-semibold">Notas da Aula</h2>
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            Fechar
          </button>
        </div>
        <div className="p-4 overflow-auto flex-1 space-y-4">
          {loading ? (
            <div className="animate-pulse text-sm text-gray-500">
              Carregando...
            </div>
          ) : editMode ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-64 resize-none rounded bg-gray-800 border border-gray-700 p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Escreva suas notas em Markdown..."
            />
          ) : (
            <div className="prose prose-invert max-w-none text-sm">
              {content ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <em className="text-gray-500">(Sem notas)</em>
              )}
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-3 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
              disabled={loading}
            >
              {editMode ? "Visualizar" : "Editar"}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={loading}
              className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
