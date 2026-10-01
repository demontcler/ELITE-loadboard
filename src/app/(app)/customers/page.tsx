import Link from "next/link";
import { listCustomers, createCustomer } from "@/server/customers";
import { PageHeader, DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";
import { CreateToggle } from "@/components/shared/create-toggle";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; create?: string }>;
}) {
  const params = await searchParams;
  const customers = await listCustomers(params.q);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="Shippers and operators — contacts, locations, documents, and job history."
        actions={
          <Can permission="customers:write">
            <CreateToggle href="/customers?create=1" label="Add Customer" />
          </Can>
        }
      />

      <Can permission="customers:write">
        {params.create === "1" ? (
          <DedicatedEntityForm
            title="New Customer"
            submitLabel="Create Customer"
            redirectBasePath="/customers"
            fields={[
              { name: "companyName", label: "Company Name", required: true, section: "Company" },
              { name: "dba", label: "DBA", section: "Company" },
              { name: "mainPhone", label: "Main Phone", section: "Company" },
              { name: "website", label: "Website", section: "Company" },
              {
                name: "status",
                label: "Status",
                section: "Company",
                options: [
                  { value: "ACTIVE", label: "Active" },
                  { value: "PENDING", label: "Pending" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "RESTRICTED", label: "Restricted" },
                ],
              },
              {
                name: "paymentTerms",
                label: "Payment Terms",
                section: "Billing",
                options: [
                  { value: "NET_30", label: "Net 30" },
                  { value: "NET_15", label: "Net 15" },
                  { value: "NET_45", label: "Net 45" },
                  { value: "NET_60", label: "Net 60" },
                  { value: "DUE_ON_RECEIPT", label: "Due on Receipt" },
                ],
              },
              { name: "creditLimit", label: "Credit Limit", type: "number", section: "Billing" },
              { name: "taxId", label: "Tax ID", section: "Billing" },
              { name: "billingAddress1", label: "Billing Address", section: "Billing", fullWidth: true },
              { name: "billingCity", label: "City", section: "Billing" },
              { name: "billingState", label: "State", section: "Billing" },
              { name: "billingZip", label: "ZIP", section: "Billing" },
              { name: "notes", label: "Notes", section: "Notes", fullWidth: true },
            ]}
            onSubmit={async (data) => {
              "use server";
              return createCustomer(data);
            }}
          />
        ) : null}
      </Can>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search company, DBA, phone…"
          className="h-9 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <button className="h-9 rounded-md bg-slate-900 px-3 text-sm text-white" type="submit">
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <EmptyState message="No customers yet." />
      ) : (
        <DataTable headers={["Company", "Phone", "Terms", "Status", "Contacts", "Jobs", ""]}>
          {customers.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-900">
                <Link href={`/customers/${c.id}`} className="hover:underline">
                  {c.companyName}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-600">{c.mainPhone ?? "—"}</td>
              <td className="px-3 py-2 text-slate-600">{c.paymentTerms.replaceAll("_", " ")}</td>
              <td className="px-3 py-2">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-3 py-2 tabular-nums">{c._count.contacts}</td>
              <td className="px-3 py-2 tabular-nums">{c._count.jobs}</td>
              <td className="px-3 py-2 text-right">
                <Link href={`/customers/${c.id}`} className="text-xs font-medium text-sky-700 hover:underline">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
