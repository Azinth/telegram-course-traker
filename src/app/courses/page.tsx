import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listCoursesWithProgressPaged } from "@/lib/repos";
import { redirect } from "next/navigation";
import CourseListClient from "@/app/courses/client";

async function userId(email: string) {
  const { query } = await import("@/lib/database");
  const res = await query("SELECT id FROM users WHERE email=$1", [email]);
  return res.rows[0].id as string;
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams?: { page?: string; perPage?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const uid = await userId(session.user.email!);
  const page = Number(searchParams?.page || 1);
  const perPage = Number(searchParams?.perPage || 10);
  const {
    courses,
    total,
    page: safePage,
    perPage: safePerPage,
  } = await listCoursesWithProgressPaged(
    uid,
    Number.isFinite(page) ? page : 1,
    Number.isFinite(perPage) ? perPage : 10,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meus cursos</h1>
      </div>
      <CourseListClient
        initialCourses={courses}
        total={total}
        initialPage={safePage}
        initialPerPage={safePerPage}
      />
    </div>
  );
}
