import "./../styles/globals.css";
import { ReactNode } from "react";
import Header from "@/components/Header";
import Providers from "./providers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const _session = (await getServerSession(
    authOptions as any,
  )) as Session | null;
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-950 text-gray-100">
        <Providers session={_session}>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
