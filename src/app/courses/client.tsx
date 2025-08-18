"use client";
import React, { useState } from "react";
import CourseCard from "@/components/CourseCard";
import AddCourseModal from "@/components/AddCourseModal";
import { useRouter } from "next/navigation";

export default function CourseListClient({
  initialCourses,
}: {
  initialCourses: any[];
}) {
  const [courses, setCourses] = useState(initialCourses || []);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  function handleSelect(c: any) {
    router.push(`/courses/${c.id}`);
  }

  async function handleSave(name: string, index: string) {
    // simple POST to create course; server route not present maybe, fallback: reload
    try {
      await fetch("/api/register", { method: "POST" });
    } catch (e) {}
    // after create, refresh the page
    router.refresh();
  }

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-4">
        {courses.map((c: any) => (
          <CourseCard key={c.id} course={c} onSelect={handleSelect} />
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
