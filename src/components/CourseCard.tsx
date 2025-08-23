"use client";
import React from "react";

const Clock = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 7v5l3 1"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function CourseCard({
  course,
  onSelect,
  onDelete,
  deleting,
  disabledClick,
}: {
  course: any;
  onSelect: (_c: any) => void;
  onDelete?: (_id: string) => void;
  deleting?: boolean;
  disabledClick?: boolean;
}) {
  const totalEpisodes =
    (course.modules || []).reduce(
      (acc: any, mod: any) => acc + (mod.episodes?.length || 0),
      0,
    ) || Number(course.total_episodes || course.totalEpisodes || 0);
  const completedEpisodes =
    (course.modules || []).reduce(
      (acc: any, mod: any) =>
        acc + (mod.episodes?.filter((e: any) => e.completed).length || 0),
      0,
    ) || Number(course.done_episodes || course.doneEpisodes || 0);
  const progress =
    totalEpisodes > 0
      ? Math.round((completedEpisodes / totalEpisodes) * 100)
      : 0;
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4 transition-all transform hover:scale-105">
      <div
        className="cursor-pointer"
        onClick={disabledClick ? undefined : () => onSelect(course)}
      >
        <h3 className="text-xl font-semibold text-white">
          {course.title || course.name}
        </h3>
        <div className="mt-4">
          <div className="flex justify-between items-center text-sm text-gray-300 mb-1">
            <span>Progresso</span>
            <span>
              {completedEpisodes} / {totalEpisodes}
            </span>
          </div>
          <div className="w-full bg-gray-500 rounded-full h-2.5">
            <div
              className="bg-blue-500 h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        <div className="mt-3 text-sm text-gray-400 flex items-center gap-2">
          <Clock />
          <span>
            Tempo total:{" "}
            {formatTime(
              Number(course.total_seconds || course.totalTimeSpent || 0),
            )}
          </span>
        </div>
      </div>
      {onDelete ? (
        <div className="mt-3 flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(course.id);
            }}
            className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-red-600/80 text-gray-200 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            title="Remover curso"
            disabled={Boolean(deleting)}
          >
            {deleting ? (
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            )}
            <span className="hidden sm:inline">
              {deleting ? "Removendo..." : "Remover"}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
