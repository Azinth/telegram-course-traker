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
}: {
  course: any;
  onSelect: (c: any) => void;
}) {
  const totalEpisodes =
    (course.modules || []).reduce(
      (acc: any, mod: any) => acc + (mod.episodes?.length || 0),
      0
    ) || Number(course.total_episodes || course.totalEpisodes || 0);
  const completedEpisodes =
    (course.modules || []).reduce(
      (acc: any, mod: any) =>
        acc + (mod.episodes?.filter((e: any) => e.completed).length || 0),
      0
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
    <div
      className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition-all transform hover:scale-105"
      onClick={() => onSelect(course)}
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
            Number(course.total_seconds || course.totalTimeSpent || 0)
          )}
        </span>
      </div>
    </div>
  );
}
