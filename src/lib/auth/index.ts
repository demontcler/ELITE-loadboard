import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { permissionsForRole, type Permission } from "@/lib/permissions";
import { isProductionLike } from "@/lib/env";
import { log } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rate-limit";

declare module "next-auth" {
  interface User {
    role: Role;
    firstName: string;
    lastName: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      role: Role;
      firstName: string;
      lastName: string;
      permissions: Permission[];
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    firstName: string;
    lastName: string;
    isActive?: boolean;
    sessionVersion?: number;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours
const SESSION_UPDATE_AGE = 60 * 30; // refresh sliding window every 30m of activity via jwt callback

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProductionLike(),
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const limit = checkRateLimit({
          key: `login:${email}`,
          limit: 20,
          windowMs: 15 * 60 * 1000,
        });
        if (!limit.allowed) {
          log.warn("auth.login_rate_limited", { email });
          return null;
        }

        const user = await prisma.user.findFirst({
          where: {
            email,
            deletedAt: null,
            isActive: true,
          },
        });

        if (!user) {
          log.warn("auth.login_failed", { email, reason: "not_found" });
          return null;
        }

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) {
          log.warn("auth.login_failed", { email, reason: "bad_password" });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        log.info("auth.login_success", { userId: user.id, role: user.role });

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.isActive = true;
        token.sessionVersion = Date.now();
      }

      // Re-check active status at most every 60s to revoke deactivated sessions
      const lastCheck = typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      const due = !lastCheck || Date.now() - lastCheck > 60_000 || user;
      if (token.id && due) {
        const dbUser = await prisma.user.findFirst({
          where: { id: token.id as string },
          select: {
            isActive: true,
            deletedAt: true,
            role: true,
            firstName: true,
            lastName: true,
          },
        });
        token.sessionVersion = Date.now();
        if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
          log.warn("auth.session_revoked", { userId: String(token.id) });
          token.isActive = false;
          // Keep shape valid for JWT typing while marking session unusable
          token.id = "" as unknown as string;
          return token;
        }
        token.isActive = true;
        token.role = dbUser.role;
        token.firstName = dbUser.firstName;
        token.lastName = dbUser.lastName;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.id || token.isActive === false || token.id === "") {
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      session.user = {
        ...session.user,
        id: token.id as string,
        email: (token.email as string) || session.user?.email || "",
        role: token.role as Role,
        firstName: token.firstName as string,
        lastName: token.lastName as string,
        permissions: permissionsForRole(token.role as Role),
      };
      return session;
    },
  },
});
