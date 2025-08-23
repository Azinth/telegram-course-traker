"use client";
import React, { useEffect, useState } from "react";
import CourseCard from "@/components/CourseCard";
import AddCourseModal from "@/components/AddCourseModal";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function CourseListClient({
  initialCourses,
}: {
  initialCourses: any[];
}) {
  const [courses, setCourses] = useState(initialCourses || []);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function SortableCourseCard({
    id,
    children,
  }: {
    id: string;
    children: React.ReactNode;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.7 : 1,
      cursor: isDragging ? "grabbing" : editMode ? "grab" : undefined,
    };
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        {children}
      </div>
    );
  }

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
        throw new Error(msg);
      }

      const { id, summary } = await response.json();
      const newCourse = {
        id,
        title,
        created_at: new Date().toISOString(),
        total_episodes: (summary?.created ?? 0) + (summary?.reused ?? 0),
        done_episodes: 0,
        total_seconds: 0,
      } as any;
      setCourses((prev: any[]) => [newCourse, ...prev]);
      setJustAddedId(id);
      setModalOpen(false);
      toast.success("Curso adicionado com sucesso!");
    } catch (error) {
      console.error("Erro ao criar curso:", error);
      try {
        toast.error((error as any)?.message || "Falha ao criar curso");
      } catch {}
      throw error;
    }
  }

  function handleDelete(id: string) {
    // open confirmation modal
    setConfirmDeleteId(id);
  }

  async function handleDeleteConfirmed() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/courses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        let msg = `HTTP error! status: ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      // Reload list from server to ensure consistency
      try {
        const listRes = await fetch(`/api/courses`);
        if (listRes.ok) {
          const json = await listRes.json();
          setCourses(json || []);
        } else {
          setCourses((prev) => prev.filter((c: any) => c.id !== id));
        }
      } catch (e) {
        setCourses((prev) => prev.filter((c: any) => c.id !== id));
      }

      toast.success("Curso deletado");
      setConfirmDeleteId(null);
    } catch (e) {
      console.error("Erro ao deletar curso:", e);
      try {
        toast.error((e as any)?.message || "Falha ao deletar curso");
      } catch {}
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-300">
          {editMode ? (
            <span>
              {Object.values(selectedIds).filter(Boolean).length} selecionado(s)
            </span>
          ) : (
            <span>Total: {courses.length}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditMode((v) => !v);
              setSelectedIds({});
            }}
            className="px-3 py-2 rounded bg-white/10 hover:bg-white/20"
          >
            {editMode ? "Concluir" : "Editar"}
          </button>
          {editMode && (
            <>
              <button
                onClick={async () => {
                  try {
                    setSavingOrder(true);
                    const ids = courses.map((c: any) => c.id);
                    const res = await fetch("/api/courses/reorder", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ids }),
                    });
                    if (!res.ok) throw new Error(`${res.status}`);
                    toast.success("Ordem salva");
                  } catch (e) {
                    toast.error("Falha ao salvar ordem");
                  } finally {
                    setSavingOrder(false);
                  }
                }}
                disabled={savingOrder}
                className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-60"
              >
                {savingOrder ? "Salvando..." : "Salvar ordem"}
              </button>
              <button
                onClick={async () => {
                  const ids = Object.entries(selectedIds)
                    .filter(([, v]) => v)
                    .map(([k]) => k);
                  if (!ids.length) return;
                  // Otimista: remove local e oferece desfazer
                  const snapshot = courses.slice();
                  setCourses((prev) =>
                    prev.filter((c: any) => !ids.includes(c.id)),
                  );
                  setSelectedIds({});
                  let cancelled = false;
                  toast.show("Cursos removidos.", "info", 4000, {
                    label: "Desfazer",
                    onAction: () => {
                      cancelled = true;
                      setCourses(snapshot);
                    },
                  });
                  setBulkDeleting(true);
                  // Aguarda a janela de undo antes de chamar o backend
                  setTimeout(async () => {
                    if (cancelled) {
                      setBulkDeleting(false);
                      return;
                    }
                    try {
                      const res = await fetch("/api/courses/bulk-delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids }),
                      });
                      if (!res.ok) throw new Error(`${res.status}`);
                      const { deleted } = await res.json();
                      toast.success(`Removido(s): ${deleted}`);
                    } catch (e) {
                      toast.error("Falha ao remover selecionados");
                      // Restaura snapshot em caso de erro
                      setCourses(snapshot);
                    } finally {
                      setBulkDeleting(false);
                    }
                  }, 1200);
                }}
                disabled={bulkDeleting}
                className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-60"
              >
                {bulkDeleting ? "Removendo..." : "Remover selecionados"}
              </button>
            </>
          )}
        </div>
      </div>

      {editMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const oldIndex = courses.findIndex((c: any) => c.id === active.id);
            const newIndex = courses.findIndex((c: any) => c.id === over.id);
            if (oldIndex < 0 || newIndex < 0) return;
            setCourses((items: any[]) => arrayMove(items, oldIndex, newIndex));
          }}
        >
          <SortableContext
            items={courses.map((c: any) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid md:grid-cols-2 gap-4">
              {courses.map((_c: any) => (
                <SortableCourseCard key={_c.id} id={_c.id}>
                  <div
                    className={
                      _c.id === justAddedId
                        ? "animate-[fadeInUp_700ms_ease-out] glow-success-strong"
                        : undefined
                    }
                  >
                    {editMode && (
                      <label className="flex items-center gap-2 mb-2 text-xs text-gray-300">
                        <input
                          type="checkbox"
                          checked={!!selectedIds[_c.id]}
                          onChange={(e) =>
                            setSelectedIds((s) => ({
                              ...s,
                              [_c.id]: e.target.checked,
                            }))
                          }
                        />
                        Selecionar
                      </label>
                    )}
                    <CourseCard
                      course={_c}
                      onSelect={handleSelect}
                      onDelete={handleDelete}
                      deleting={deletingId === _c.id}
                      disabledClick={editMode}
                    />
                  </div>
                </SortableCourseCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
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
              {editMode && (
                <label className="flex items-center gap-2 mb-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={!!selectedIds[_c.id]}
                    onChange={(e) =>
                      setSelectedIds((s) => ({
                        ...s,
                        [_c.id]: e.target.checked,
                      }))
                    }
                  />
                  Selecionar
                </label>
              )}
              <CourseCard
                course={_c}
                onSelect={handleSelect}
                onDelete={handleDelete}
                deleting={deletingId === _c.id}
                disabledClick={editMode}
              />
            </div>
          ))}
        </div>
      )}
      {/* Confirmation modal */}
      {confirmDeleteId ? (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmDeleteId(null)}
          />
          <div className="bg-gray-800 p-6 rounded-lg z-10 w-11/12 max-w-md">
            <h2 className="text-lg font-bold mb-2">Confirmar exclusão</h2>
            <p className="text-sm text-gray-300 mb-4">
              Tem certeza que deseja deletar este curso? Esta ação não pode ser
              desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded bg-gray-600 hover:bg-gray-500"
                onClick={() => setConfirmDeleteId(null)}
                disabled={Boolean(deletingId)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-2 rounded bg-red-600 hover:bg-red-500 flex items-center gap-2"
                onClick={handleDeleteConfirmed}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
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
                ) : null}
                {deletingId ? "Deletando..." : "Deletar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-6">
        <button
          onClick={() => setModalOpen(true)}
          className="px-3 py-2 rounded bg-white/10 hover:bg-white/20"
        >
          Adicionar curso
        </button>
        {editMode && (
          <span className="ml-2 inline-flex gap-2">
            <button
              onClick={() =>
                setSelectedIds(
                  courses.reduce(
                    (acc: any, c: any) => ({ ...acc, [c.id]: true }),
                    {},
                  ),
                )
              }
              className="px-3 py-2 rounded bg-white/10 hover:bg-white/20"
            >
              Selecionar todos
            </button>
            <button
              onClick={() => setSelectedIds({})}
              className="px-3 py-2 rounded bg-white/10 hover:bg-white/20"
            >
              Limpar seleção
            </button>
          </span>
        )}
      </div>
      <AddCourseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
