"use client";
import React, { useEffect, useState } from "react";
import CourseCard from "@/components/CourseCard";
import AddCourseModal from "@/components/AddCourseModal";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export default function CourseListClient({
  initialCourses,
}: {
  initialCourses: any[];
}) {
  const [courses, setCourses] = useState(initialCourses || []);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();

  function handleSelect(c: any) {
    router.push(`/courses/${c.id}`);
  }

  // Mantenha o destaque visível por mais tempo (ex.: 2.2s)
  useEffect(() => {
    if (!justAddedId) return;
    const t = setTimeout(() => setJustAddedId(null), 2200);
    return () => clearTimeout(t);
  }, [justAddedId]);

  async function handleSave(title: string, payloadOrIndex: any) {
    // POST to create course
    try {
      // payloadOrIndex may be the index string (old) or a JSON string with { index, options }
      let index: string;
      let options: any = undefined;
      try {
        const parsed =
          typeof payloadOrIndex === "string"
            ? JSON.parse(payloadOrIndex)
            : payloadOrIndex;
        index = parsed.index ?? payloadOrIndex;
        options = parsed.options ?? undefined;
      } catch {
        index = payloadOrIndex;
      }

      const response = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, index, options }),
      });

      if (!response.ok) {
        let msg = `HTTP error! status: ${response.status}`;
        try {
          const j = await response.json();
          if (j?.error) msg = j.error;
        } catch {}
        console.error("Falha ao criar curso:", msg);
        throw new Error(msg);
      }

      // Mantém o usuário na lista e injeta o curso recém-criado
      const { id, summary } = await response.json();
      const newCourse = {
        id,
        title,
        created_at: new Date().toISOString(),
        // Sem módulos ainda no cliente; usa contadores agregados
        total_episodes: (summary?.created ?? 0) + (summary?.reused ?? 0),
        done_episodes: 0,
        total_seconds: 0,
      } as any;
      setCourses((prev: any[]) => [newCourse, ...prev]);
      setJustAddedId(id);
      setModalOpen(false);
      toast.success("Curso adicionado com sucesso!");
    } catch (error) {
      console.error("Error creating course:", error);
      try {
        const msg = (error as any)?.message || "Falha ao criar curso";
        toast.error(msg);
      } catch {}
      // Propaga para o modal exibir
      throw error;
    }
  }

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-4">
        {courses.map((_c: any) => (
          <div
            key={_c.id}
            className={
              _c.id === justAddedId
                ? "animate-[fadeInUp_700ms_ease-out] glow-success-strong"
                : undefined
            }
          >
            <CourseCard course={_c} onSelect={handleSelect} />
          </div>
        ))}
      </div>
      <div className="mt-6">
        <button
          onClick={() => setModalOpen(true)}
          className="px-3 py-2 rounded bg-white/10 hover:bg-white/20"
        >
          Adicionar curso
        </button>
      </div>
      <AddCourseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
