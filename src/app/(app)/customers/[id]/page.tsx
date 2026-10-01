import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCustomer,
  addCustomerContact,
  addCustomerLocation,
} from "@/server/customers";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { CreateEntityForm } from "@/components/shared/create-entity-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/customers" className="hover:underline">
          Customers
        </Link>{" "}
        / {customer.companyName}
      </div>

      <PageHeader
        title={customer.companyName}
        description={customer.dba ? `DBA ${customer.dba}` : "Customer profile"}
        actions={<StatusBadge status={customer.status} />}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>Phone: {customer.mainPhone ?? "—"}</div>
            <div>Website: {customer.website ?? "—"}</div>
            <div>Tax ID: {customer.taxId ?? "—"}</div>
            <div>Terms: {customer.paymentTerms.replaceAll("_", " ")}</div>
            <div>
              Credit limit:{" "}
              {customer.creditLimit != null ? formatCurrency(customer.creditLimit.toString()) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Billing address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            <div>{customer.billingAddress1 ?? "—"}</div>
            {customer.billingAddress2 ? <div>{customer.billingAddress2}</div> : null}
            <div>
              {[customer.billingCity, customer.billingState, customer.billingZip]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 whitespace-pre-wrap">
            {customer.notes || "No notes"}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Contacts</h2>
          <CreateEntityForm
            title="Add Contact"
            submitLabel="Add Contact"
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "title", label: "Title" },
              { name: "department", label: "Department" },
              { name: "email", label: "Email", type: "email" },
              { name: "phone", label: "Phone" },
              { name: "mobile", label: "Mobile" },
              {
                name: "role",
                label: "Role",
                options: [
                  { value: "Dispatcher", label: "Dispatcher" },
                  { value: "Billing", label: "Billing" },
                  { value: "Accounts Payable", label: "Accounts Payable" },
                  { value: "Field Contact", label: "Field Contact" },
                  { value: "Operations Manager", label: "Operations Manager" },
                  { value: "Safety", label: "Safety" },
                ],
              },
            ]}
            onSubmit={async (data) => {
              "use server";
              await addCustomerContact(id, data);
            }}
          />
        </div>
        {customer.contacts.length === 0 ? (
          <EmptyState message="No contacts yet." />
        ) : (
          <DataTable headers={["Name", "Role", "Email", "Phone", "Mobile"]}>
            {customer.contacts.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-medium">
                  {c.name}
                  {c.isPrimary ? (
                    <Badge className="ml-2" variant="info">
                      Primary
                    </Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-600">{c.role ?? c.title ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{c.email ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{c.phone ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{c.mobile ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Locations</h2>
          <CreateEntityForm
            title="Add Location"
            submitLabel="Add Location"
            fields={[
              { name: "name", label: "Location Name", required: true },
              {
                name: "locationType",
                label: "Type",
                options: [
                  { value: "Yard", label: "Yard" },
                  { value: "Rig", label: "Rig" },
                  { value: "Lease", label: "Lease" },
                  { value: "Warehouse", label: "Warehouse" },
                  { value: "Other", label: "Other" },
                ],
              },
              { name: "address1", label: "Address" },
              { name: "city", label: "City" },
              { name: "state", label: "State" },
              { name: "zip", label: "ZIP" },
              { name: "county", label: "County" },
              { name: "rigName", label: "Rig Name" },
              { name: "rigNumber", label: "Rig Number" },
              { name: "leaseName", label: "Lease Name" },
              { name: "wellName", label: "Well Name" },
              { name: "latitude", label: "Latitude" },
              { name: "longitude", label: "Longitude" },
              { name: "directions", label: "Directions" },
              { name: "gateInstructions", label: "Gate Instructions" },
              { name: "contactName", label: "Contact" },
              { name: "contactPhone", label: "Contact Phone" },
            ]}
            onSubmit={async (data) => {
              "use server";
              await addCustomerLocation(id, data);
            }}
          />
        </div>
        {customer.locations.length === 0 ? (
          <EmptyState message="No locations yet. Oilfield sites can use lease/well/rig instead of street address." />
        ) : (
          <DataTable headers={["Name", "Type", "City/State", "Rig / Lease / Well", "Contact"]}>
            {customer.locations.map((loc) => (
              <tr key={loc.id}>
                <td className="px-3 py-2 font-medium">{loc.name}</td>
                <td className="px-3 py-2 text-slate-600">{loc.locationType ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">
                  {[loc.city, loc.state].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {[loc.rigName, loc.leaseName, loc.wellName].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {loc.contactName ?? "—"}
                  {loc.contactPhone ? ` · ${loc.contactPhone}` : ""}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Load history</h2>
        {customer.jobs.length === 0 ? (
          <EmptyState message="No jobs yet for this customer." />
        ) : (
          <DataTable headers={["Job", "Status", "Pickup", "Trucks", "Revenue", "Rig"]}>
            {customer.jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-3 py-2 font-medium">{job.jobNumber}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {job.pickupDate ? job.pickupDate.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums">{job.trucksRequired}</td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrency(job.totalRevenue.toString())}
                </td>
                <td className="px-3 py-2 text-slate-600">{job.rigName ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Documents</h2>
        {customer.documents.length === 0 ? (
          <EmptyState message="Document uploads land in Phase 5 — MSA, rate agreements, insurance requirements, etc." />
        ) : (
          <DataTable headers={["Type", "File", "Status", "Expires"]}>
            {customer.documents.map((doc) => (
              <tr key={doc.id}>
                <td className="px-3 py-2">{doc.documentType}</td>
                <td className="px-3 py-2">{doc.fileName}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-3 py-2">
                  {doc.expirationDate ? doc.expirationDate.toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
