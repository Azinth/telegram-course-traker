"use client";
import React from "react";

export default function ModuleProgressCircle({
  value,
  size = 22,
  strokeWidth = 3,
}: {
  value: number; // 0..1
  size?: number;
  strokeWidth?: number;
}) {
  const v = Math.max(0, Math.min(1, value || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference;
  const offset = circumference * (1 - v);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block"
      aria-label={`Progresso do módulo: ${Math.round(v * 100)}%`}
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {/* trilha vermelha (não feito) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#b91c1c" /* red-700 */
          strokeOpacity={0.8}
          strokeWidth={strokeWidth}
        />
        {/* progresso verde (feito) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#16a34a" /* green-600 */
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${dash}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
