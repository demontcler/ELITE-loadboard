import Link from "next/link";
import { listCustomers, createCustomer } from "@/server/customers";
import { PageHeader, DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { CreateEntityForm } from "@/components/shared/create-entity-form";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const customers = await listCustomers(params.q);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="Shippers and operators — contacts, locations, documents, and job history."
        actions={
          <CreateEntityForm
            title="New Customer"
            submitLabel="Add Customer"
            fields={[
              { name: "companyName", label: "Company Name", required: true },
              { name: "dba", label: "DBA" },
              { name: "mainPhone", label: "Main Phone" },
              { name: "website", label: "Website" },
              {
                name: "paymentTerms",
                label: "Payment Terms",
                options: [
                  { value: "NET_30", label: "Net 30" },
                  { value: "NET_15", label: "Net 15" },
                  { value: "NET_45", label: "Net 45" },
                  { value: "NET_60", label: "Net 60" },
                  { value: "DUE_ON_RECEIPT", label: "Due on Receipt" },
                ],
              },
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "ACTIVE", label: "Active" },
                  { value: "PENDING", label: "Pending" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "RESTRICTED", label: "Restricted" },
                ],
              },
              { name: "taxId", label: "Tax ID" },
              { name: "creditLimit", label: "Credit Limit", type: "number" },
              { name: "notes", label: "Notes" },
            ]}
            onSubmit={async (data) => {
              "use server";
              await createCustomer(data);
            }}
          />
        }
      />

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
        <EmptyState message="No customers yet. Add your first oilfield operator or shipper." />
      ) : (
        <DataTable headers={["Company", "Phone", "Terms", "Status", "Contacts", "Jobs", ""]}>
          {customers.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-900">
                <Link href={`/customers/${c.id}`} className="hover:underline">
                  {c.companyName}
                </Link>
                {c.dba ? <div className="text-xs text-slate-400">DBA {c.dba}</div> : null}
              </td>
              <td className="px-3 py-2 text-slate-600">{c.mainPhone ?? "—"}</td>
              <td className="px-3 py-2 text-slate-600">{c.paymentTerms.replaceAll("_", " ")}</td>
              <td className="px-3 py-2">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-3 py-2 tabular-nums text-slate-600">{c._count.contacts}</td>
              <td className="px-3 py-2 tabular-nums text-slate-600">{c._count.jobs}</td>
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
