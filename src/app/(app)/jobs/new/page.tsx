import Link from "next/link";
import { listCustomers } from "@/server/customers";
import { createJob } from "@/server/jobs";
import { PageHeader } from "@/components/shared/page-chrome";
import { CreateEntityForm } from "@/components/shared/create-entity-form";
import { redirect } from "next/navigation";

export default async function NewJobPage() {
  const customers = await listCustomers();

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/load-board" className="hover:underline">
          Load Board
        </Link>{" "}
        / New Job
      </div>
      <PageHeader
        title="Create Job"
        description="Parent transportation order. Specify trucks required — each truck becomes an independent assignment with its own cargo."
      />

      {customers.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add a customer first before creating a job.{" "}
          <Link href="/customers" className="font-medium underline">
            Go to Customers
          </Link>
        </div>
      ) : (
        <CreateEntityForm
          title="Job details"
          submitLabel="Create Job"
          defaultOpen
          fields={[
            {
              name: "customerId",
              label: "Customer",
              required: true,
              options: customers.map((c) => ({ value: c.id, label: c.companyName })),
            },
            {
              name: "jobType",
              label: "Job Type",
              options: [
                { value: "OILFIELD", label: "Oilfield" },
                { value: "PIPE", label: "Pipe" },
                { value: "FLATBED", label: "Flatbed" },
                { value: "EQUIPMENT", label: "Equipment" },
                { value: "RIG_MATERIALS", label: "Rig Materials" },
                { value: "MULTI_TRUCK_PROJECT", label: "Multi-Truck Project" },
                { value: "OTHER", label: "Other" },
              ],
            },
            { name: "trucksRequired", label: "Trucks Required", type: "number", required: true },
            { name: "pickupDate", label: "Pickup Date", type: "date" },
            { name: "pickupTime", label: "Pickup Time", placeholder: "07:00" },
            { name: "deliveryDate", label: "Delivery Date", type: "date" },
            { name: "deliveryTime", label: "Delivery Time", placeholder: "14:00" },
            { name: "customerPoNumber", label: "Customer PO #" },
            { name: "customerReferenceNumber", label: "Customer Ref #" },
            { name: "orderNumber", label: "Order #" },
            { name: "requestedBy", label: "Requested By" },
            { name: "customerContactName", label: "Customer Contact" },
            { name: "customerContactPhone", label: "Contact Phone" },
            { name: "pickupName", label: "Pickup Name / Yard" },
            { name: "pickupAddress1", label: "Pickup Address" },
            { name: "pickupCity", label: "Pickup City" },
            { name: "pickupState", label: "Pickup State" },
            { name: "pickupCounty", label: "Pickup County" },
            { name: "pickupDirections", label: "Pickup Directions" },
            { name: "pickupGateInstructions", label: "Pickup Gate Instructions" },
            { name: "deliveryName", label: "Delivery Name" },
            { name: "deliveryAddress1", label: "Delivery Address" },
            { name: "deliveryCity", label: "Delivery City" },
            { name: "deliveryState", label: "Delivery State" },
            { name: "deliveryCounty", label: "Delivery County" },
            { name: "deliveryDirections", label: "Delivery Directions" },
            { name: "rigName", label: "Rig Name" },
            { name: "rigNumber", label: "Rig Number" },
            { name: "leaseName", label: "Lease Name" },
            { name: "wellName", label: "Well Name" },
            { name: "afeNumber", label: "AFE Number" },
            { name: "fieldContactName", label: "Field Contact" },
            { name: "fieldContactPhone", label: "Field Contact Phone" },
            { name: "equipmentRequirements", label: "Equipment Requirements" },
            { name: "customerRate", label: "Customer Rate ($)", type: "number" },
            {
              name: "billingMethod",
              label: "Billing Method",
              options: [
                { value: "PER_TRUCK", label: "Per Truck" },
                { value: "PER_LOAD", label: "Per Load" },
                { value: "FLAT_RATE", label: "Flat Rate" },
                { value: "PER_MILE", label: "Per Mile" },
                { value: "PER_HOUR", label: "Per Hour" },
                { value: "PER_FOOT", label: "Per Foot" },
                { value: "OTHER", label: "Other" },
              ],
            },
            { name: "specialInstructions", label: "Special Instructions" },
            { name: "notes", label: "Notes" },
          ]}
          defaultValues={{ trucksRequired: "1", jobType: "OILFIELD", billingMethod: "PER_TRUCK" }}
          onSubmit={async (data) => {
            "use server";
            const job = await createJob(data);
            redirect(`/jobs/${job.id}`);
          }}
        />
      )}
    </div>
  );
}
