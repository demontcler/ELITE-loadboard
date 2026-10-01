import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader, AppSidebar } from "@/components/layout/sidebar";
import { AuthzProvider } from "@/components/auth/can";
import type { Role } from "@prisma/client";
import type { Permission } from "@/lib/permissions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userName = `${session.user.firstName} ${session.user.lastName}`;

  return (
    <AuthzProvider
      value={{
        role: session.user.role as Role,
        permissions: session.user.permissions as Permission[],
        userId: session.user.id,
        userName,
      }}
    >
      <div className="flex min-h-screen bg-slate-100">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader userName={userName} role={session.user.role} />
          <main className="flex-1 overflow-auto p-4 md:p-5">{children}</main>
        </div>
      </div>
    </AuthzProvider>
  );
}
