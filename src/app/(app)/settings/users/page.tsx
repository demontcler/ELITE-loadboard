import Link from "next/link";
import { redirect } from "next/navigation";
import { listUsers } from "@/server/users";
import { requireUserPermission } from "@/lib/auth/session";
import { PageHeader, DataTable, StatusBadge } from "@/components/shared/page-chrome";
import { CreateUserForm, UserRowActions } from "@/components/users/user-admin";

export default async function UsersSettingsPage() {
  try {
    await requireUserPermission("users:manage");
  } catch {
    redirect("/settings");
  }
  const users = await listUsers();

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/settings" className="hover:underline">
          Settings
        </Link>{" "}
        / Users
      </div>
      <PageHeader
        title="User management"
        description="Provision users, assign roles, and deactivate access. Password hashes are never displayed."
      />

      <CreateUserForm />

      <DataTable headers={["Name", "Email", "Role", "Status", "Last login", "Actions"]}>
        {users.map((u) => (
          <tr key={u.id} className="border-t border-slate-100">
            <td className="px-3 py-2 font-medium">
              {u.lastName}, {u.firstName}
            </td>
            <td className="px-3 py-2">{u.email}</td>
            <td className="px-3 py-2">
              <StatusBadge status={u.role} />
            </td>
            <td className="px-3 py-2">
              <StatusBadge status={u.isActive ? "ACTIVE" : "INACTIVE"} />
            </td>
            <td className="px-3 py-2 tabular-nums text-xs">
              {u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 16).replace("T", " ") : "—"}
            </td>
            <td className="px-3 py-2">
              <UserRowActions userId={u.id} role={u.role} isActive={u.isActive} />
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
