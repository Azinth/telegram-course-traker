import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listCoursesWithProgress } from "@/lib/repos";
import { query } from "@/lib/database";
import { redirect } from "next/navigation";
import CourseListClient from "@/app/courses/client";

async function userId(email: string) {
  const res = await query("SELECT id FROM users WHERE email=$1", [email]);
  return res.rows[0].id as string;
}

export default async function CoursesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const uid = await userId(session.user.email!);
  const courses = await listCoursesWithProgress(uid);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meus cursos</h1>
      </div>
      <CourseListClient initialCourses={courses} />
    </div>
  );
}
