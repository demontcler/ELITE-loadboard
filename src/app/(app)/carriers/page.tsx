import Link from "next/link";
import { listCarriers, createCarrier } from "@/server/carriers";
import { PageHeader, DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { CreateEntityForm } from "@/components/shared/create-entity-form";

export default async function CarriersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const carriers = await listCarriers(params.q);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Carriers"
        description="Approved and preferred carriers — MC/USDOT, compliance, drivers, and equipment."
        actions={
          <CreateEntityForm
            title="New Carrier"
            submitLabel="Add Carrier"
            fields={[
              { name: "legalName", label: "Legal Company Name", required: true },
              { name: "dba", label: "DBA" },
              { name: "mcNumber", label: "MC Number" },
              { name: "usdotNumber", label: "USDOT Number" },
              { name: "phone", label: "Phone" },
              { name: "email", label: "Email", type: "email" },
              { name: "taxId", label: "Tax ID" },
              { name: "city", label: "City" },
              { name: "state", label: "State" },
              {
                name: "approvalStatus",
                label: "Approval",
                options: [
                  { value: "PENDING", label: "Pending" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "PREFERRED", label: "Preferred" },
                  { value: "RESTRICTED", label: "Restricted" },
                  { value: "INACTIVE", label: "Inactive" },
                ],
              },
              {
                name: "paymentTerms",
                label: "Payment Terms",
                options: [
                  { value: "NET_30", label: "Net 30" },
                  { value: "NET_15", label: "Net 15" },
                  { value: "NET_45", label: "Net 45" },
                  { value: "DUE_ON_RECEIPT", label: "Due on Receipt" },
                ],
              },
            ]}
            onSubmit={async (data) => {
              "use server";
              await createCarrier(data);
            }}
          />
        }
      />

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
        <EmptyState message="No carriers yet. Add approved haulers for oilfield and flatbed work." />
      ) : (
        <DataTable
          headers={["Carrier", "MC", "USDOT", "Approval", "Status", "Drivers", "Equipment", ""]}
        >
          {carriers.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium">
                <Link href={`/carriers/${c.id}`} className="hover:underline">
                  {c.legalName}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-600">{c.mcNumber ?? "—"}</td>
              <td className="px-3 py-2 text-slate-600">{c.usdotNumber ?? "—"}</td>
              <td className="px-3 py-2">
                <StatusBadge status={c.approvalStatus} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-3 py-2 tabular-nums">{c._count.drivers}</td>
              <td className="px-3 py-2 tabular-nums">
                {c._count.tractors + c._count.trailers}
              </td>
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
