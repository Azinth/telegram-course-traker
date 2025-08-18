"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Timer from "@/components/Timer";
import EpisodeNoteModal from "@/components/EpisodeNoteModal";

export default function CourseClient({ course }: { course: any }) {
  const [data, setData] = useState(course);
  const [busy, setBusy] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [noteEpisodeId, setNoteEpisodeId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [noteInitialContent, setNoteInitialContent] = useState<string | null>(
    null
  );

  // Sync timer state with server
  useEffect(() => {
    let mounted = true;
    async function syncTimer() {
      try {
        const res = await fetch(`/api/courses/${data.id}/timer`);
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        setData((d: any) => ({
          ...d,
          total_seconds: Number(json.seconds || 0),
        }));
        setIsActive(Boolean(json.active));
        if (json.active) {
          if (timerRef.current == null) {
            timerRef.current = window.setInterval(() => {
              setData((d: any) => ({
                ...d,
                total_seconds: Number(d.total_seconds || 0) + 1,
              }));
            }, 1000);
          }
        } else if (timerRef.current != null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } catch {}
    }
    const t = setTimeout(() => setLoadingInitial(false), 400);
    // populate favorites from initial payload
    try {
      const favs: Record<string, boolean> = {};
      data.modules.forEach((m: any) =>
        (m.episodes || []).forEach((e: any) => {
          if (e.favorited) favs[e.id] = true;
        })
      );
      setFavorites(favs);
    } catch {}
    syncTimer();
    return () => {
      mounted = false;
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      clearTimeout(t);
    };
  }, [data.id]);

  async function toggleEpisode(ep: any) {
    setBusy(true);
    try {
      await fetch(`/api/courses/${data.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: ep.id, completed: !ep.completed }),
      });
      ep.completed = !ep.completed;
      setData({ ...data });
    } catch {}
    setBusy(false);
  }

  async function action(a: "start" | "pause" | "stop") {
    setBusy(true);
    try {
      await fetch(`/api/courses/${data.id}/timer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: a }),
      });
    } catch {}
    setBusy(false);
    // refresh after action
    try {
      const res = await fetch(`/api/courses/${data.id}/timer`);
      if (res.ok) {
        const json = await res.json();
        setData((d: any) => ({
          ...d,
          total_seconds: Number(json.seconds || 0),
        }));
        setIsActive(Boolean(json.active));
        if (!json.active && timerRef.current != null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } catch {}
  }

  function toggleModule(id: string, fallbackOpen: boolean) {
    setOpenModules((s) => ({
      ...s,
      [id]: s[id] == null ? !fallbackOpen : !s[id],
    }));
  }

  // Icons
  const ChevronDown = (props: any) => (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
  const ChevronUp = (props: any) => (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
  const Circle = (props: any) => (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
  const CheckCircle = (props: any) => (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
  const Star = (props: any) => (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
  const StarFilled = (props: any) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
  const NoteIcon = (props: any) => (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M12 4h9" />
      <path d="M12 12h9" />
      <path d="M3 6h.01" />
      <path d="M3 18h.01" />
      <path d="M3 12h.01" />
    </svg>
  );

  async function toggleFavorite(epId: string) {
    try {
      const res = await fetch(`/api/episodes/${epId}/favorite`, {
        method: "POST",
      });
      if (res.ok) {
        const j = await res.json();
        setFavorites((f) => ({ ...f, [epId]: j.favorited }));
      }
    } catch {}
  }

  const total = Number(data.total_seconds || 0);
  const progress = (() => {
    const episodes = data.modules.flatMap((m: any) => m.episodes || []);
    const done = episodes.filter((e: any) => e.completed).length;
    return episodes.length ? Math.round((done / episodes.length) * 100) : 0;
  })();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/courses" className="text-sm text-blue-400 hover:underline">
          &larr; Voltar para Meus Cursos
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">{data.title}</h1>
        <div className="bg-gray-800 rounded-lg p-4">
          <Timer
            totalTime={total}
            isActive={isActive}
            onStart={() => action("start")}
            onPause={() => action("pause")}
            onStop={() => action("stop")}
          />
          <div className="mt-3 text-sm text-gray-400">
            Progresso geral: {progress}%
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {data.modules.map((m: any, idx: number) => {
          const fallbackOpen = idx === 0; // primeiro módulo aberto por padrão
          const open = openModules[m.id] ?? fallbackOpen;
          const moduleEpisodes = m.episodes || [];
          const moduleDone =
            moduleEpisodes.length &&
            moduleEpisodes.every((e: any) => e.completed);
          return (
            <div
              key={m.id}
              className={`bg-gray-800 rounded-lg ${
                moduleDone
                  ? "border border-green-600"
                  : "border border-transparent"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleModule(m.id, fallbackOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-medium">{m.title}</span>
                {open ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
              {open && (
                <div className="px-4 pb-4 border-t border-gray-700">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-4">
                    {loadingInitial &&
                      Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-10 rounded bg-gray-700 animate-pulse"
                        />
                      ))}
                    {!loadingInitial &&
                      m.episodes.map((e: any) => {
                        const done = e.completed;
                        const fav = favorites[e.id];
                        return (
                          <div
                            key={e.id}
                            className={`group relative flex items-center gap-1 rounded px-2 py-2 text-xs font-mono transition-colors border border-transparent ${
                              done
                                ? "bg-green-700/60 hover:bg-green-600/60 text-green-100"
                                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                            }`}
                          >
                            <button
                              onClick={() => toggleEpisode(e)}
                              disabled={busy}
                              className="flex items-center gap-1 mr-1"
                            >
                              {done ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Circle className="w-4 h-4 text-gray-400" />
                              )}
                              <span>#{e.tag}</span>
                            </button>
                            <div className="ml-auto flex gap-1">
                              <button
                                onClick={() => toggleFavorite(e.id)}
                                className="p-1 rounded hover:bg-black/20"
                                title={fav ? "Desfavoritar" : "Favoritar"}
                              >
                                {fav ? (
                                  <StarFilled className="w-4 h-4 text-yellow-400" />
                                ) : (
                                  <Star className="w-4 h-4 text-gray-300" />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  setNoteInitialContent(e.note_content || null);
                                  setNoteEpisodeId(e.id);
                                }}
                                className="p-1 rounded hover:bg-black/20"
                                title="Notas"
                              >
                                <NoteIcon className="w-4 h-4 text-blue-300" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <EpisodeNoteModal
        episodeId={noteEpisodeId}
        initialContent={noteInitialContent}
        open={!!noteEpisodeId}
        onClose={() => {
          setNoteEpisodeId(null);
          setNoteInitialContent(null);
        }}
        onSaved={(content: string) => {
          // update local data so UI reflects saved note without reload
          if (!noteEpisodeId) return;
          setData((prev: any) => {
            const next = { ...prev };
            try {
              next.modules = next.modules.map((m: any) => ({
                ...m,
                episodes: (m.episodes || []).map((e: any) =>
                  e.id === noteEpisodeId ? { ...e, note_content: content } : e
                ),
              }));
            } catch (e) {}
            return next;
          });
          setNoteInitialContent(content);
        }}
      />
    </div>
  );
}
