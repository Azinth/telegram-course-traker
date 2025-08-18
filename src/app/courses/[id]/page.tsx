import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCourseDetail } from "@/lib/repos";
import { redirect } from "next/navigation";
import CourseClient from "./view";

export default async function CourseDetail({ params }: { params: { id: string } }){
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const course = await getCourseDetail(await userId(session.user.email!), params.id);
  if (!course) redirect("/courses");
  return <CourseClient course={course} />;
}

async function userId(email: string): Promise<string>{
  const { query } = await import("@/lib/database");
  const res = await query("SELECT id FROM users WHERE email=$1", [email]);
  return res.rows[0].id as string;
}
