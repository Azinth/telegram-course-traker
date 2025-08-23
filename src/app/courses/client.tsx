"use client";
import React, { useEffect, useMemo, useState } from "react";
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

type Course = any;

export default function CourseListClient({
  initialCourses,
  total: initialTotal,
  initialPage = 1,
  initialPerPage = 10,
}: {
  initialCourses: Course[];
  total?: number;
  initialPage?: number;
  initialPerPage?: number;
}) {
  const [courses, setCourses] = useState<Course[]>(initialCourses || []);
  const [total, setTotal] = useState<number>(
    initialTotal ?? (initialCourses || []).length,
  );
  const [page, setPage] = useState<number>(initialPage || 1);
  const [perPage, setPerPage] = useState<number>(initialPerPage || 10);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  // Lista completa para edição (sem paginação)
  const [editCourses, setEditCourses] = useState<Course[] | null>(null);

  const router = useRouter();
  const toast = useToast();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  async function fetchPage(p: number, pp: number) {
    try {
      const res = await fetch(`/api/courses?page=${p}&perPage=${pp}`);
      if (!res.ok) return;
      const j = await res.json();
      setCourses(j.courses || []);
      setTotal(j.total ?? 0);
      setPage(j.page ?? p);
      setPerPage(j.perPage ?? pp);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (!editMode) fetchPage(page, perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, editMode]);

  // destaque após adicionar
  useEffect(() => {
    if (!justAddedId) return;
    const t = setTimeout(() => setJustAddedId(null), 2200);
    return () => clearTimeout(t);
  }, [justAddedId]);

  async function fetchAllCourses(): Promise<Course[]> {
    // busca todas as páginas em lotes de 100
    const first = await fetch(`/api/courses?page=1&perPage=100`);
    if (!first.ok) return [];
    const j = await first.json();
    const all: Course[] = j.courses || [];
    const totalCount = Number(j.total || all.length);
    const pages = Math.max(1, Math.ceil(totalCount / 100));
    if (pages > 1) {
      for (let p = 2; p <= pages; p++) {
        const r = await fetch(`/api/courses?page=${p}&perPage=100`);
        if (r.ok) {
          const jj = await r.json();
          all.push(...(jj.courses || []));
        }
      }
    }
    return all;
  }

  async function handleSave(title: string, packedIndex: string) {
    try {
      let indexPayload: any = null;
      try {
        indexPayload = JSON.parse(packedIndex);
      } catch {
        indexPayload = { index: String(packedIndex || "") };
      }
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          index: indexPayload.index,
          options: indexPayload.options,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setModalOpen(false);
      toast.success("Curso adicionado");
      // refresh listas
      if (editMode) {
        const all = await fetchAllCourses();
        setEditCourses(all);
        setJustAddedId(all[0]?.id || null);
      } else {
        setPage(1);
        await fetchPage(1, perPage);
        // destacar primeiro da lista
        try {
          const first = await fetch(`/api/courses?page=1&perPage=${perPage}`);
          if (first.ok) {
            const jj = await first.json();
            setJustAddedId(jj.courses?.[0]?.id || null);
          }
        } catch {}
      }
    } catch (e) {
      toast.error("Falha ao criar curso");
    }
  }

  function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  async function handleDeleteConfirmed() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/courses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      toast.success("Curso deletado");
      const jRes = await fetch(`/api/courses?page=${page}&perPage=${perPage}`);
      const body = await jRes.json();
      if (
        Array.isArray(body.courses) &&
        body.courses.length === 0 &&
        page > 1
      ) {
        setPage((p) => p - 1);
      } else {
        await fetchPage(page, perPage);
      }
      setConfirmDeleteId(null);
    } catch (e) {
      toast.error("Falha ao deletar");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    const ids = Object.entries(selectedIds)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      // otimista com undo apenas em modo edição (lista completa)
      const isEditing = editMode;
      if (isEditing && Array.isArray(editCourses)) {
        const snapshot = editCourses.slice();
        setEditCourses((prev) =>
          (prev || []).filter((c: any) => !ids.includes(c.id)),
        );
        setSelectedIds({});
        let cancelled = false;
        toast.show("Cursos removidos.", "info", 4000, {
          label: "Desfazer",
          onAction: () => {
            cancelled = true;
            setEditCourses(snapshot);
          },
        });
        setTimeout(async () => {
          if (cancelled) {
            setBulkDeleting(false);
            return;
          }
          const res = await fetch(`/api/courses/bulk-delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          });
          if (!res.ok) throw new Error("failed");
          toast.success("Removidos");
          // atualizar lista paginada atual
          await fetchPage(page, perPage);
          setBulkDeleting(false);
        }, 1200);
      } else {
        const res = await fetch(`/api/courses/bulk-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) throw new Error("failed");
        toast.success("Removidos");
        setSelectedIds({});
        const jRes = await fetch(
          `/api/courses?page=${page}&perPage=${perPage}`,
        );
        const body = await jRes.json();
        if (
          Array.isArray(body.courses) &&
          body.courses.length === 0 &&
          page > 1
        )
          setPage((p) => p - 1);
        else await fetchPage(page, perPage);
      }
    } catch (e) {
      toast.error("Falha ao remover selecionados");
    } finally {
      setBulkDeleting(false);
    }
  }

  function openCourse(id: string) {
    router.push(`/courses/${id}`);
  }

  const maxPage = Math.max(1, Math.ceil(total / perPage));

  // Sortable wrapper
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {/* Esquerda: info ou selector */}
        {editMode ? (
          <div className="text-sm text-gray-300">
            {Object.values(selectedIds).filter(Boolean).length} selecionado(s)
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Por página:</span>
            <select
              value={perPage}
              onChange={(e) => {
                const np = Number(e.target.value);
                setPerPage(np);
                setPage(1);
              }}
              className="bg-gray-900 text-sm rounded px-2 py-1"
            >
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}

        {/* Direita: ações topo */}
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (editMode) {
                // concluir edição
                setEditMode(false);
                setSelectedIds({});
                setEditCourses(null);
                await fetchPage(page, perPage);
              } else {
                setEditMode(true);
                const all = await fetchAllCourses();
                setEditCourses(all);
              }
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
                    if (!Array.isArray(editCourses)) return;
                    setSavingOrder(true);
                    const ids = editCourses.map((c: any) => c.id);
                    const res = await fetch("/api/courses/reorder", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ids }),
                    });
                    if (!res.ok) throw new Error(`${res.status}`);
                    toast.success("Ordem salva");
                    await fetchPage(page, perPage);
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
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-60"
              >
                {bulkDeleting ? "Removendo..." : "Remover selecionados"}
              </button>
            </>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            Adicionar curso
          </button>
        </div>
      </div>

      {/* Lista */}
      {editMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id || !Array.isArray(editCourses))
              return;
            const oldIndex = editCourses.findIndex(
              (c: any) => c.id === active.id,
            );
            const newIndex = editCourses.findIndex(
              (c: any) => c.id === over.id,
            );
            if (oldIndex < 0 || newIndex < 0) return;
            setEditCourses((items: any[] | null) =>
              Array.isArray(items)
                ? arrayMove(items, oldIndex, newIndex)
                : items,
            );
          }}
        >
          <SortableContext
            items={(editCourses || []).map((c: any) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid md:grid-cols-2 gap-4">
              {(editCourses || []).map((c: any) => (
                <SortableCourseCard key={c.id} id={c.id}>
                  <div
                    className={
                      c.id === justAddedId
                        ? "animate-[fadeInUp_700ms_ease-out] glow-success-strong"
                        : undefined
                    }
                  >
                    <label className="flex items-center gap-2 mb-2 text-xs text-gray-300">
                      <input
                        type="checkbox"
                        checked={!!selectedIds[c.id]}
                        onChange={(e) =>
                          setSelectedIds((s) => ({
                            ...s,
                            [c.id]: e.target.checked,
                          }))
                        }
                      />
                      Selecionar
                    </label>
                    <CourseCard
                      course={c}
                      onSelect={(cc) => openCourse(cc.id)}
                      onDelete={() => handleDelete(c.id)}
                      deleting={deletingId === c.id}
                      disabledClick={true}
                    />
                  </div>
                </SortableCourseCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {courses.map((c) => (
              <div
                key={c.id}
                className={
                  c.id === justAddedId
                    ? "animate-[fadeInUp_700ms_ease-out] glow-success-strong"
                    : undefined
                }
              >
                <CourseCard
                  course={c}
                  onSelect={(cc) => openCourse(cc.id)}
                  onDelete={() => handleDelete(c.id)}
                  deleting={deletingId === c.id}
                />
              </div>
            ))}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => {
                if (page > 1) setPage((p) => p - 1);
              }}
              className="px-3 py-1 rounded bg-white/10"
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span className="text-sm text-gray-300">
              Página {page} / {maxPage}
            </span>
            <button
              onClick={() => {
                if (page < maxPage) setPage((p) => p + 1);
              }}
              className="px-3 py-1 rounded bg-white/10"
              disabled={page >= maxPage}
            >
              Próxima
            </button>
          </div>
        </>
      )}

      {/* Modal adicionar */}
      <AddCourseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      {/* Confirmação delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmDeleteId(null)}
          />
          <div className="bg-gray-800 p-6 rounded-lg z-10 w-11/12 max-w-md">
            <h2 className="text-lg font-bold mb-2">Confirmar exclusão</h2>
            <p className="text-sm text-gray-300 mb-4">
              Tem certeza que deseja deletar este curso?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded bg-gray-600"
                onClick={() => setConfirmDeleteId(null)}
                disabled={Boolean(deletingId)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-2 rounded bg-red-600"
                onClick={handleDeleteConfirmed}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? "Deletando..." : "Deletar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
