"use client";
import React, { useState } from "react";
import CourseCard from "@/components/CourseCard";
import AddCourseModal from "@/components/AddCourseModal";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export default function CourseListClient({
  initialCourses,
}: {
  initialCourses: any[];
}) {
  const [courses, _setCourses] = useState(initialCourses || []);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();

  function handleSelect(c: any) {
    router.push(`/courses/${c.id}`);
  }

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

      // Redireciona direto para a página do curso recém-criado
      const { id } = await response.json();
      // como haverá navegação, agende um toast de sucesso para a próxima tela
      toast.showNextPage("Curso criado com sucesso!", "success");
      setModalOpen(false);
      router.push(`/courses/${id}`);
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
          <CourseCard key={_c.id} course={_c} onSelect={handleSelect} />
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
