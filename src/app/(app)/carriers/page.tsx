import Link from "next/link";
import { listCarriers, createCarrier } from "@/server/carriers";
import { PageHeader, DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { DedicatedEntityForm, type FormField } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";
import { CreateToggle } from "@/components/shared/create-toggle";

const CARRIER_FIELDS: FormField[] = [
  { name: "legalName", label: "Legal Company Name", required: true, section: "Company" },
  { name: "dba", label: "DBA", section: "Company" },
  { name: "mcNumber", label: "MC Number", section: "Authority" },
  { name: "usdotNumber", label: "USDOT Number", section: "Authority" },
  { name: "taxId", label: "Tax ID", section: "Authority" },
  { name: "phone", label: "Phone", section: "Contact" },
  { name: "email", label: "Email", type: "email", section: "Contact" },
  { name: "address1", label: "Address", section: "Address", fullWidth: true },
  { name: "city", label: "City", section: "Address" },
  { name: "state", label: "State", section: "Address" },
  { name: "zip", label: "ZIP", section: "Address" },
  {
    name: "approvalStatus",
    label: "Approval",
    section: "Status",
    options: [
      { value: "PENDING", label: "Pending" },
      { value: "APPROVED", label: "Approved" },
      { value: "PREFERRED", label: "Preferred" },
      { value: "RESTRICTED", label: "Restricted" },
      { value: "INACTIVE", label: "Inactive" },
    ],
  },
  {
    name: "status",
    label: "Status",
    section: "Status",
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
    section: "Accounting",
    options: [
      { value: "NET_30", label: "Net 30" },
      { value: "NET_15", label: "Net 15" },
      { value: "NET_45", label: "Net 45" },
      { value: "DUE_ON_RECEIPT", label: "Due on Receipt" },
    ],
  },
  { name: "preferredPaymentMethod", label: "Preferred Payment Method", section: "Accounting" },
  { name: "safetyNotes", label: "Safety Notes", section: "Notes", fullWidth: true },
  { name: "internalNotes", label: "Internal Notes", section: "Notes", fullWidth: true },
] as const;

export default async function CarriersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; create?: string }>;
}) {
  const params = await searchParams;
  const carriers = await listCarriers(params.q);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Carriers"
        description="Approved and preferred carriers — MC/USDOT, compliance, drivers, and equipment."
        actions={
          <Can permission="carriers:write">
            <CreateToggle href="/carriers?create=1" label="Add Carrier" />
          </Can>
        }
      />

      <Can permission="carriers:write">
        {params.create === "1" ? (
          <DedicatedEntityForm
            title="New Carrier"
            submitLabel="Create Carrier"
            fields={[...CARRIER_FIELDS]}
            redirectBasePath="/carriers"
            onSubmit={async (data) => {
              "use server";
              return createCarrier(data);
            }}
          />
        ) : null}
      </Can>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search name, MC, USDOT…"
          className="h-9 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <button className="h-9 rounded-md bg-slate-900 px-3 text-sm text-white" type="submit">
          Search
        </button>
      </form>

      {carriers.length === 0 ? (
        <EmptyState message="No carriers yet." />
      ) : (
        <DataTable headers={["Carrier", "MC", "USDOT", "Approval", "Status", "Drivers", ""]}>
          {carriers.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium">
                <Link href={`/carriers/${c.id}`} className="hover:underline">
                  {c.legalName}
                </Link>
              </td>
              <td className="px-3 py-2">{c.mcNumber ?? "—"}</td>
              <td className="px-3 py-2">{c.usdotNumber ?? "—"}</td>
              <td className="px-3 py-2">
                <StatusBadge status={c.approvalStatus} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-3 py-2 tabular-nums">{c._count.drivers}</td>
              <td className="px-3 py-2 text-right">
                <Link href={`/carriers/${c.id}`} className="text-xs font-medium text-sky-700 hover:underline">
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
