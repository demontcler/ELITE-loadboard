import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCarrier,
  updateCarrier,
  softDeleteCarrier,
  addCarrierContact,
  softDeleteCarrierContact,
} from "@/server/carriers";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchiveButton } from "@/components/shared/archive-button";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { CARRIER_DOC_TYPES } from "@/lib/documents/types";

export default async function CarrierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const carrier = await getCarrier(id);
  if (!carrier) notFound();

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/carriers" className="hover:underline">
          Carriers
        </Link>{" "}
        / {carrier.legalName}
      </div>

      <PageHeader
        title={carrier.legalName}
        description={carrier.dba ? `DBA ${carrier.dba}` : "Carrier profile"}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={carrier.approvalStatus} />
            <StatusBadge status={carrier.status} />
            <Can permission="carriers:write">
              <Link
                href={`/carriers/${id}?edit=1`}
                className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium leading-8 hover:bg-slate-50"
              >
                Edit
              </Link>
              <ArchiveButton
                label="Archive"
                action={async () => {
                  "use server";
                  await softDeleteCarrier(id);
                }}
              />
            </Can>
          </div>
        }
      />

      <Can permission="carriers:write">
        {sp.edit === "1" ? (
          <DedicatedEntityForm
            title="Edit Carrier"
            submitLabel="Save Changes"
            redirectTo={`/carriers/${id}`}
            defaultValues={{
              legalName: carrier.legalName,
              dba: carrier.dba ?? "",
              mcNumber: carrier.mcNumber ?? "",
              usdotNumber: carrier.usdotNumber ?? "",
              taxId: carrier.taxId ?? "",
              phone: carrier.phone ?? "",
              email: carrier.email ?? "",
              address1: carrier.address1 ?? "",
              city: carrier.city ?? "",
              state: carrier.state ?? "",
              zip: carrier.zip ?? "",
              approvalStatus: carrier.approvalStatus,
              status: carrier.status,
              paymentTerms: carrier.paymentTerms,
              preferredPaymentMethod: carrier.preferredPaymentMethod ?? "",
              safetyNotes: carrier.safetyNotes ?? "",
              internalNotes: carrier.internalNotes ?? "",
            }}
            fields={[
              { name: "legalName", label: "Legal Name", required: true, section: "Company" },
              { name: "dba", label: "DBA", section: "Company" },
              { name: "mcNumber", label: "MC", section: "Authority" },
              { name: "usdotNumber", label: "USDOT", section: "Authority" },
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
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "RESTRICTED", label: "Restricted" },
                  { value: "ARCHIVED", label: "Archived" },
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
                  { value: "CUSTOM", label: "Custom" },
                  { value: "NET_60", label: "Net 60" },
                ],
              },
              { name: "preferredPaymentMethod", label: "Pay Method", section: "Accounting" },
              { name: "safetyNotes", label: "Safety Notes", section: "Notes", fullWidth: true },
              { name: "internalNotes", label: "Internal Notes", section: "Notes", fullWidth: true },
            ]}
            onSubmit={async (data) => {
              "use server";
              return updateCarrier(id, data);
            }}
          />
        ) : null}
      </Can>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>MC: {carrier.mcNumber ?? "—"}</div>
            <div>USDOT: {carrier.usdotNumber ?? "—"}</div>
            <div>Tax ID: {carrier.taxId ?? "—"}</div>
            <div>Phone: {carrier.phone ?? "—"}</div>
            <div>Email: {carrier.email ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Address / Terms</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            <div>{carrier.address1 ?? "—"}</div>
            <div>{[carrier.city, carrier.state, carrier.zip].filter(Boolean).join(", ") || "—"}</div>
            <div className="mt-2">Terms: {carrier.paymentTerms.replaceAll("_", " ")}</div>
            <div>Pay method: {carrier.preferredPaymentMethod ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Safety</div>
              <div className="whitespace-pre-wrap">{carrier.safetyNotes || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Internal</div>
              <div className="whitespace-pre-wrap">{carrier.internalNotes || "—"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Contacts (Dispatch / Accounting)</h2>
        <Can permission="carriers:write">
          <DedicatedEntityForm
            title="Add Contact"
            submitLabel="Add Contact"
            collapsible
            fields={[
              { name: "name", label: "Name", required: true, section: "Contact" },
              { name: "title", label: "Title", section: "Contact" },
              { name: "email", label: "Email", type: "email", section: "Contact" },
              { name: "phone", label: "Phone", section: "Contact" },
              { name: "mobile", label: "Mobile", section: "Contact" },
              {
                name: "role",
                label: "Role",
                section: "Contact",
                options: [
                  { value: "Primary", label: "Primary" },
                  { value: "Dispatch", label: "Dispatch" },
                  { value: "Accounting", label: "Accounting" },
                ],
              },
            ]}
            onSubmit={async (data) => {
              "use server";
              await addCarrierContact(id, data);
            }}
          />
        </Can>
        {carrier.contacts.length === 0 ? (
          <EmptyState message="No contacts yet." />
        ) : (
          <DataTable headers={["Name", "Role", "Email", "Phone", ""]}>
            {carrier.contacts.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">{c.role ?? "—"}</td>
                <td className="px-3 py-2">{c.email ?? "—"}</td>
                <td className="px-3 py-2">{c.phone ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Can permission="carriers:write">
                    <ArchiveButton
                      label="Remove"
                      action={async () => {
                        "use server";
                        await softDeleteCarrierContact(c.id);
                      }}
                    />
                  </Can>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Drivers</h2>
        {carrier.drivers.length === 0 ? (
          <EmptyState message="No drivers linked." />
        ) : (
          <DataTable headers={["Name", "Phone", "CDL", "Status"]}>
            {carrier.drivers.map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/drivers/${d.id}`} className="hover:underline">
                    {d.lastName}, {d.firstName}
                  </Link>
                </td>
                <td className="px-3 py-2">{d.phone ?? "—"}</td>
                <td className="px-3 py-2">{d.cdlNumber ?? "—"}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={d.status} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Equipment</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Tractors</h3>
            {carrier.tractors.length === 0 ? (
              <EmptyState message="No tractors." />
            ) : (
              <DataTable headers={["Unit", "Year/Make", "Status"]}>
                {carrier.tractors.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/equipment/tractors/${t.id}`} className="hover:underline">
                        {t.unitNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {[t.year, t.make, t.model].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Trailers</h3>
            {carrier.trailers.length === 0 ? (
              <EmptyState message="No trailers." />
            ) : (
              <DataTable headers={["Unit", "Type", "Status"]}>
                {carrier.trailers.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/equipment/trailers/${t.id}`} className="hover:underline">
                        {t.unitNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {t.customType || t.trailerType.replaceAll("_", " ")}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </div>
      </section>

      <DocumentsPanel
        ownerType="CARRIER"
        ownerId={carrier.id}
        documents={carrier.documents}
        documentTypes={[...CARRIER_DOC_TYPES]}
        title="Compliance Documents"
      />
    </div>
  );
}
