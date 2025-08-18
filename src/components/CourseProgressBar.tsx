"use client";
import React, { useMemo, useState } from "react";

interface CourseProgressBarProps {
  done: number;
  total: number;
  className?: string;
  totalSeconds?: number; // seconds of total tracked time for this course
  segments?: { id: string; title?: string; count: number }[];
  animateSteps?: boolean;
}

export default function CourseProgressBar({
  done,
  total,
  className = "",
  totalSeconds = 0,
  segments,
  animateSteps = false,
}: CourseProgressBarProps) {
  const safeTotal = total > 0 ? total : 0;
  const percent = safeTotal
    ? Math.min(100, Math.round((done / safeTotal) * 100))
    : 0;
  const remaining = Math.max(0, safeTotal - done);

  // estimate remaining time using avg seconds per completed episode
  let eta: string | null = null;
  if (done > 0 && totalSeconds > 0 && remaining > 0) {
    const avg = totalSeconds / done; // seconds per completed episode
    const remSeconds = Math.round(avg * remaining);
    const h = Math.floor(remSeconds / 3600);
    const m = Math.floor((remSeconds % 3600) / 60);
    eta = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const gradientClass =
    percent < 30
      ? "from-red-400 via-yellow-400 to-yellow-500"
      : percent < 70
        ? "from-yellow-400 via-amber-400 to-lime-400"
        : "from-green-500 via-emerald-500 to-green-400";

  // build segment positions: start/end percent for each module
  const segmentPositions = useMemo(() => {
    const out: {
      id?: string;
      title?: string;
      start: number;
      end: number;
      index: number;
    }[] = [];
    if (!segments || segments.length === 0 || total <= 0) return out;
    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const start = (acc / total) * 100;
      acc += seg.count;
      const end = (acc / total) * 100;
      out.push({ id: seg.id, title: seg.title, start, end, index: i });
    }
    return out;
  }, [segments, total]);

  // boundaries (including 0% and 100%) para desenhar divisões visuais completas
  const boundaries = useMemo(() => {
    if (!segmentPositions.length) return [] as number[];
    return [0, ...segmentPositions.map((s) => s.end)]; // último end deve ser 100%
  }, [segmentPositions]);

  const [hoveredSeg, setHoveredSeg] = useState<number | null>(null);

  return (
    <div
      className={`space-y-1 ${className}`}
      aria-label="Progresso do curso"
      role="group"
    >
      <div className="flex justify-between text-[11px] tracking-wide font-mono text-gray-400">
        <span>
          {done} / {safeTotal} aulas
        </span>
        <span>
          {percent}% (restam {remaining})
        </span>
      </div>
      <div className="relative h-4 w-full overflow-hidden rounded-md bg-gray-700/70 border border-gray-600">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.06)_50%,rgba(255,255,255,0.06)_75%,transparent_75%,transparent)] bg-[length:14px_14px] opacity-40 pointer-events-none" />
        <div className="absolute inset-0">
          {/* module overlays to highlight region on hover (no pointer events) */}
          {segmentPositions.map((s) => (
            <div
              key={s.index}
              style={{
                left: `${s.start}%`,
                width: `${Math.max(0.1, s.end - s.start)}%`,
              }}
              className={`absolute top-0 bottom-0 pointer-events-none transition-opacity duration-200 module-overlay ${
                hoveredSeg === s.index ? "opacity-70" : "opacity-0"
              }`}
            />
          ))}
          {boundaries.map((b, i) => (
            <div
              key={i}
              style={{ left: `${b}%` }}
              className="absolute top-0 bottom-0 w-px bg-white/10 pointer-events-none"
            />
          ))}
          <div
            className={`h-full flex items-center justify-end pr-2 text-[10px] font-semibold text-white rounded-md shadow-inner shadow-black/40 ${
              animateSteps ? "progress-steps" : "progress-transition"
            } bg-gradient-to-r ${gradientClass}`}
            style={{
              width: `${percent}%`,
              transitionTimingFunction: animateSteps
                ? `steps(${Math.max(1, safeTotal)}, end)`
                : undefined,
            }}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          >
            {percent > 7 && <span>{percent}%</span>}
          </div>
        </div>
      </div>
      {segmentPositions.length > 0 && (
        <div className="relative mt-2 h-5 w-full select-none">
          {segmentPositions.map((s) => {
            // centro do módulo
            let center = (s.start + s.end) / 2;
            // clamp para evitar que M1 saia para fora ou último fique cortado
            if (center < 2) center = 2; // 2%
            if (center > 98) center = 98; // 98%
            let transform = "-translate-x-1/2";
            if (center === 2) transform = "translate-x-0"; // esquerda
            if (center === 98) transform = "-translate-x-full"; // direita
            return (
              <div
                key={s.index}
                style={{ left: `${center}%` }}
                className={`absolute top-0 w-8 ${transform} text-[11px] font-mono text-gray-300 text-center cursor-pointer`}
                onMouseEnter={() => setHoveredSeg(s.index)}
                onMouseLeave={() => setHoveredSeg(null)}
                title={s.title || `M${s.index + 1}`}
              >
                {`M${s.index + 1}`}
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-1 text-xs text-gray-300 font-mono">
        {eta ? `Tempo estimado restante: ${eta}` : "Tempo estimado: —"}
      </div>
    </div>
  );
}
