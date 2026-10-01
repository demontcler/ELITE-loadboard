import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCustomer,
  updateCustomer,
  softDeleteCustomer,
  addCustomerContact,
  softDeleteCustomerContact,
  addCustomerLocation,
  softDeleteCustomerLocation,
} from "@/server/customers";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArchiveButton } from "@/components/shared/archive-button";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { CUSTOMER_DOC_TYPES } from "@/lib/documents/types";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={customer.status} />
            <Can permission="customers:write">
              <Link
                href={`/customers/${id}?edit=1`}
                className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium leading-8 hover:bg-slate-50"
              >
                Edit
              </Link>
              <ArchiveButton
                label="Archive"
                action={async () => {
                  "use server";
                  await softDeleteCustomer(id);
                }}
              />
            </Can>
          </div>
        }
      />

      <Can permission="customers:write">
        {sp.edit === "1" ? (
          <DedicatedEntityForm
            title="Edit Customer"
            submitLabel="Save Changes"
            redirectTo={`/customers/${id}`}
            defaultValues={{
              companyName: customer.companyName,
              dba: customer.dba ?? "",
              mainPhone: customer.mainPhone ?? "",
              website: customer.website ?? "",
              status: customer.status,
              paymentTerms: customer.paymentTerms,
              creditLimit: customer.creditLimit?.toString() ?? "",
              taxId: customer.taxId ?? "",
              billingAddress1: customer.billingAddress1 ?? "",
              billingCity: customer.billingCity ?? "",
              billingState: customer.billingState ?? "",
              billingZip: customer.billingZip ?? "",
              physicalAddress1: customer.physicalAddress1 ?? "",
              physicalCity: customer.physicalCity ?? "",
              physicalState: customer.physicalState ?? "",
              physicalZip: customer.physicalZip ?? "",
              notes: customer.notes ?? "",
            }}
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
                  { value: "ARCHIVED", label: "Archived" },
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
                  { value: "CUSTOM", label: "Custom" },
                ],
              },
              { name: "creditLimit", label: "Credit Limit", type: "number", section: "Billing" },
              { name: "taxId", label: "Tax ID", section: "Billing" },
              { name: "billingAddress1", label: "Billing Address", section: "Billing", fullWidth: true },
              { name: "billingCity", label: "City", section: "Billing" },
              { name: "billingState", label: "State", section: "Billing" },
              { name: "billingZip", label: "ZIP", section: "Billing" },
              { name: "physicalAddress1", label: "Physical Address", section: "Physical", fullWidth: true },
              { name: "physicalCity", label: "City", section: "Physical" },
              { name: "physicalState", label: "State", section: "Physical" },
              { name: "physicalZip", label: "ZIP", section: "Physical" },
              { name: "notes", label: "Notes", section: "Notes", fullWidth: true },
            ]}
            onSubmit={async (data) => {
              "use server";
              return updateCustomer(id, data);
            }}
          />
        ) : null}
      </Can>

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
          <CardContent className="whitespace-pre-wrap text-sm text-slate-600">
            {customer.notes || "No notes"}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Contacts</h2>
        </div>
        <Can permission="customers:write">
          <DedicatedEntityForm
            title="Add Contact"
            submitLabel="Add Contact"
            collapsible
            fields={[              { name: "name", label: "Name", required: true, section: "Contact" },
              { name: "title", label: "Title", section: "Contact" },
              { name: "email", label: "Email", type: "email", section: "Contact" },
              { name: "phone", label: "Phone", section: "Contact" },
              { name: "mobile", label: "Mobile", section: "Contact" },
              {
                name: "role",
                label: "Role",
                section: "Contact",
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
        </Can>
        {customer.contacts.length === 0 ? (
          <EmptyState message="No contacts yet." />
        ) : (
          <DataTable headers={["Name", "Role", "Email", "Phone", ""]}>
            {customer.contacts.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">{c.role ?? c.title ?? "—"}</td>
                <td className="px-3 py-2">{c.email ?? "—"}</td>
                <td className="px-3 py-2">{c.phone ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Can permission="customers:write">
                    <ArchiveButton
                      label="Remove"
                      action={async () => {
                        "use server";
                        await softDeleteCustomerContact(c.id);
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
        <h2 className="text-sm font-semibold">Locations</h2>
        <Can permission="customers:write">
          <DedicatedEntityForm
            title="Add Location"
            submitLabel="Add Location"
            collapsible
            fields={[              { name: "name", label: "Location Name", required: true, section: "Location" },
              {
                name: "locationType",
                label: "Type",
                section: "Location",
                options: [
                  { value: "Yard", label: "Yard" },
                  { value: "Rig", label: "Rig" },
                  { value: "Lease", label: "Lease" },
                  { value: "Warehouse", label: "Warehouse" },
                  { value: "Other", label: "Other" },
                ],
              },
              { name: "city", label: "City", section: "Location" },
              { name: "state", label: "State", section: "Location" },
              { name: "county", label: "County", section: "Location" },
              { name: "rigName", label: "Rig Name", section: "Oilfield" },
              { name: "leaseName", label: "Lease", section: "Oilfield" },
              { name: "wellName", label: "Well", section: "Oilfield" },
              { name: "directions", label: "Directions", section: "Oilfield", fullWidth: true },
              { name: "gateInstructions", label: "Gate Instructions", section: "Oilfield", fullWidth: true },
              { name: "contactName", label: "Contact", section: "Contact" },
              { name: "contactPhone", label: "Contact Phone", section: "Contact" },
            ]}
            onSubmit={async (data) => {
              "use server";
              await addCustomerLocation(id, data);
            }}
          />
        </Can>
        {customer.locations.length === 0 ? (
          <EmptyState message="No locations yet." />
        ) : (
          <DataTable headers={["Name", "Type", "City/State", "Rig / Lease / Well", ""]}>
            {customer.locations.map((loc) => (
              <tr key={loc.id}>
                <td className="px-3 py-2 font-medium">{loc.name}</td>
                <td className="px-3 py-2">{loc.locationType ?? "—"}</td>
                <td className="px-3 py-2">
                  {[loc.city, loc.state].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-3 py-2">
                  {[loc.rigName, loc.leaseName, loc.wellName].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Can permission="customers:write">
                    <ArchiveButton
                      label="Remove"
                      action={async () => {
                        "use server";
                        await softDeleteCustomerLocation(loc.id);
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
        <h2 className="text-sm font-semibold">Load history</h2>
        {customer.jobs.length === 0 ? (
          <EmptyState message="No jobs yet for this customer." />
        ) : (
          <DataTable headers={["Job", "Status", "Pickup", "Trucks", "Revenue", "Rig"]}>
            {customer.jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/jobs/${job.id}`} className="hover:underline">
                    {job.jobNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-3 py-2">
                  {job.pickupDate ? job.pickupDate.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums">{job.trucksRequired}</td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrency(job.totalRevenue.toString())}
                </td>
                <td className="px-3 py-2">{job.rigName ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <DocumentsPanel
        ownerType="CUSTOMER"
        ownerId={customer.id}
        documents={customer.documents}
        documentTypes={[...CUSTOMER_DOC_TYPES]}
        title="Documents / Compliance"
      />
    </div>
  );
}
