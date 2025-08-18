"use client";
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

const Book = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 6.5C3 5.67157 3.67157 5 4.5 5H19.5C20.3284 5 21 5.67157 21 6.5V18.5C21 19.3284 20.3284 20 19.5 20H4.5C3.67157 20 3 19.3284 3 18.5V6.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 8H21"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Header() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <header className="bg-gray-800 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Book className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-bold">Course Tracker</h1>
          {session?.user && (
            <Link
              href="/courses"
              className="ml-3 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm hidden md:inline-block"
            >
              Meus cursos
            </Link>
          )}
        </div>
        <div ref={ref} className="relative">
          {session?.user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setOpen((s) => !s)}
                aria-expanded={open}
                className="text-sm opacity-90 px-2 py-1 rounded hover:bg-white/5 flex items-center gap-2 focus:outline-none"
              >
                <span className="truncate max-w-[10rem]">
                  {session.user.name}
                </span>
                <svg
                  className={`w-4 h-4 text-white/80 transition-transform duration-200 ${
                    open ? "rotate-180" : "rotate-0"
                  }`}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div
                className={`absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded shadow-lg z-50 transform origin-top-right transition-all duration-150 ${
                  open
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-95 pointer-events-none"
                }`}
                role="menu"
                aria-hidden={!open}
              >
                {/* little arrow */}
                <div className="absolute right-4 -top-2 w-3 h-3 bg-gray-900 transform rotate-45 border-t border-l border-gray-700" />
                <Link
                  href="/courses"
                  className="block px-3 py-2 text-sm hover:bg-gray-800 md:hidden"
                >
                  Meus cursos
                </Link>
                <a
                  href="/settings"
                  className="block px-3 py-2 text-sm hover:bg-gray-800"
                >
                  Configurações
                </a>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800"
                >
                  Sair
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
