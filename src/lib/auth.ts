import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { query } from "@/lib/database";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const res = await query(
          "SELECT id, name, email, password_hash FROM users WHERE email=$1",
          [credentials.email],
        );
        const user = res.rows[0];
        if (!user) return null;
        const ok = await bcrypt.compare(
          credentials.password,
          user.password_hash,
        );
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email } as User;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
