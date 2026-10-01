import Link from "next/link";
import { listCustomers } from "@/server/customers";
import { createJob } from "@/server/jobs";
import { PageHeader } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";

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

      <Can
        permission="jobs:write"
        fallback={
          <div className="rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            You have view-only access. Creating jobs requires write permission.
          </div>
        }
      >
        {customers.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Add a customer first before creating a job.{" "}
            <Link href="/customers" className="font-medium underline">
              Go to Customers
            </Link>
          </div>
        ) : (
          <DedicatedEntityForm
            title="Job details"
            submitLabel="Create Job"
            redirectBasePath="/jobs"
            fields={[
              {
                name: "customerId",
                label: "Customer",
                required: true,
                section: "Customer",
                options: customers.map((c) => ({ value: c.id, label: c.companyName })),
              },
              {
                name: "jobType",
                label: "Job Type",
                section: "Customer",
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
              {
                name: "trucksRequired",
                label: "Trucks Required",
                type: "number",
                required: true,
                section: "Customer",
              },
              { name: "customerPoNumber", label: "Customer PO #", section: "References" },
              { name: "customerReferenceNumber", label: "Customer Ref #", section: "References" },
              { name: "orderNumber", label: "Order #", section: "References" },
              { name: "requestedBy", label: "Requested By", section: "References" },
              { name: "customerContactName", label: "Customer Contact", section: "References" },
              { name: "customerContactPhone", label: "Contact Phone", section: "References" },
              { name: "pickupDate", label: "Pickup Date", type: "date", section: "Schedule" },
              { name: "pickupTime", label: "Pickup Time", section: "Schedule", placeholder: "07:00" },
              { name: "deliveryDate", label: "Delivery Date", type: "date", section: "Schedule" },
              {
                name: "deliveryTime",
                label: "Delivery Time",
                section: "Schedule",
                placeholder: "14:00",
              },
              { name: "pickupName", label: "Pickup Name / Yard", section: "Pickup" },
              { name: "pickupAddress1", label: "Pickup Address", section: "Pickup", fullWidth: true },
              { name: "pickupCity", label: "Pickup City", section: "Pickup" },
              { name: "pickupState", label: "Pickup State", section: "Pickup" },
              { name: "pickupCounty", label: "Pickup County", section: "Pickup" },
              {
                name: "pickupDirections",
                label: "Pickup Directions",
                section: "Pickup",
                fullWidth: true,
              },
              {
                name: "pickupGateInstructions",
                label: "Pickup Gate Instructions",
                section: "Pickup",
                fullWidth: true,
              },
              { name: "deliveryName", label: "Delivery Name", section: "Delivery" },
              {
                name: "deliveryAddress1",
                label: "Delivery Address",
                section: "Delivery",
                fullWidth: true,
              },
              { name: "deliveryCity", label: "Delivery City", section: "Delivery" },
              { name: "deliveryState", label: "Delivery State", section: "Delivery" },
              { name: "deliveryCounty", label: "Delivery County", section: "Delivery" },
              {
                name: "deliveryDirections",
                label: "Delivery Directions",
                section: "Delivery",
                fullWidth: true,
              },
              { name: "rigName", label: "Rig Name", section: "Oilfield" },
              { name: "rigNumber", label: "Rig Number", section: "Oilfield" },
              { name: "leaseName", label: "Lease Name", section: "Oilfield" },
              { name: "wellName", label: "Well Name", section: "Oilfield" },
              { name: "afeNumber", label: "AFE Number", section: "Oilfield" },
              { name: "fieldContactName", label: "Field Contact", section: "Oilfield" },
              { name: "fieldContactPhone", label: "Field Phone", section: "Oilfield" },
              {
                name: "customerRate",
                label: "Customer Rate (Job Total $)",
                type: "number",
                section: "Rates",
              },
              {
                name: "billingMethod",
                label: "Billing Method",
                section: "Rates",
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
              {
                name: "equipmentRequirements",
                label: "Equipment Requirements",
                section: "Notes",
                fullWidth: true,
              },
              {
                name: "specialInstructions",
                label: "Special Instructions",
                section: "Notes",
                fullWidth: true,
              },
              { name: "notes", label: "Internal Notes", section: "Notes", fullWidth: true },
            ]}
            defaultValues={{ trucksRequired: "1", jobType: "OILFIELD", billingMethod: "PER_TRUCK" }}
            onSubmit={async (data) => {
              "use server";
              return createJob(data);
            }}
          />
        )}
      </Can>
    </div>
  );
}
