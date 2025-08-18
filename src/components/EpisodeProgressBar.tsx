"use client";
import React, { useMemo } from "react";

interface EpisodeProgressBarProps {
  episodes: { id: string; completed: boolean; position?: number }[];
  lastChangedId?: string | null;
  compactThreshold?: number; // opcional para futura otimização
}

// Barra de progresso composta por pontos (um por aula)
export default function EpisodeProgressBar({
  episodes,
  lastChangedId,
}: EpisodeProgressBarProps) {
  const total = episodes.length;
  const done = episodes.filter((e) => e.completed).length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  // Ordena por position se existir, senão mantém ordem original
  const ordered = useMemo(() => {
    return [...episodes].sort((a, b) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      return pa - pb;
    });
  }, [episodes]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
        <span>
          {done} / {total} aulas ({percent}%)
        </span>
        <span>Restantes: {total - done}</span>
      </div>
      <div className="relative overflow-hidden rounded-md bg-gray-800/70 p-2 border border-gray-700">
        <div className="flex flex-wrap gap-1 max-h-40 overflow-auto pr-1 custom-scrollbar">
          {ordered.map((ep) => {
            const completed = ep.completed;
            const animate = ep.id === lastChangedId;
            return (
              <div
                key={ep.id}
                className={`w-3 h-3 rounded-sm transition-colors duration-300 flex items-center justify-center text-[8px] font-semibold select-none ${
                  completed
                    ? "bg-green-500 shadow-inner shadow-green-900 text-white"
                    : "bg-gray-600 hover:bg-gray-500 text-transparent"
                } ${animate ? "animate-pop" : ""}`}
                title={`Aula ${ep.position ?? ""} - ${
                  completed ? "Concluída" : "Pendente"
                }`}
                aria-label={`Aula ${ep.position ?? ""} ${
                  completed ? "concluída" : "pendente"
                }`}
              />
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-green-400 via-green-500 to-emerald-500 transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
