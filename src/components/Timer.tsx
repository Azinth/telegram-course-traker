"use client";
import React, { useEffect, useState } from "react";

const Play = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
  </svg>
);
const Pause = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
  </svg>
);
const StopCircle = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3 7h6v6H9V9z"
      fill="currentColor"
    />
  </svg>
);

export default function Timer({
  totalTime = 0,
  onStart,
  onPause,
  onStop,
  isActive,
}: {
  totalTime?: number;
  onStart?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  isActive?: boolean;
}) {
  const [time, setTime] = useState<number>(totalTime || 0);

  useEffect(() => {
    setTime(totalTime || 0);
  }, [totalTime]);

  useEffect(() => {
    let interval: number | undefined;
    if (isActive) {
      interval = window.setInterval(() => setTime((t) => t + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
      <span className="text-3xl font-mono text-white">{formatTime(time)}</span>
      <div className="flex gap-2">
        {!isActive ? (
          <button
            onClick={onStart}
            className="p-3 bg-green-500 rounded-full text-white hover:bg-green-400"
          >
            <Play />
          </button>
        ) : (
          <button
            onClick={onPause}
            className="p-3 bg-yellow-500 rounded-full text-white hover:bg-yellow-400"
          >
            <Pause />
          </button>
        )}
        <button
          onClick={onStop}
          className="p-3 bg-red-500 rounded-full text-white hover:bg-red-400"
        >
          <StopCircle />
        </button>
      </div>
    </div>
  );
}
