import { hash } from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("admin123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@elite-loadboard.local" },
    update: {
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: "admin@elite-loadboard.local",
      passwordHash,
      firstName: "System",
      lastName: "Admin",
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "dispatch@elite-loadboard.local" },
    update: {},
    create: {
      email: "dispatch@elite-loadboard.local",
      passwordHash: await hash("dispatch123!", 12),
      firstName: "Dana",
      lastName: "Dispatcher",
      role: Role.DISPATCHER,
    },
  });

  await prisma.user.upsert({
    where: { email: "accounting@elite-loadboard.local" },
    update: {},
    create: {
      email: "accounting@elite-loadboard.local",
      passwordHash: await hash("accounting123!", 12),
      firstName: "Alex",
      lastName: "Accounting",
      role: Role.ACCOUNTING,
    },
  });

  const existingSettings = await prisma.companySettings.findFirst();
  if (!existingSettings) {
    await prisma.companySettings.create({
      data: {
        companyName: "ELITE Logistics",
        defaultWeightWarningLbs: 48000,
        expiresSoonDays: 30,
        timezone: "America/Chicago",
      },
    });
  }

  const paperworkDefaults = [
    {
      entityType: "TRUCK_ASSIGNMENT",
      documentType: "RATE_CONFIRMATION",
      label: "Rate Confirmation",
      isRequired: true,
      blocksPayment: false,
    },
    {
      entityType: "TRUCK_ASSIGNMENT",
      documentType: "BOL",
      label: "BOL",
      isRequired: true,
      blocksPayment: false,
    },
    {
      entityType: "TRUCK_ASSIGNMENT",
      documentType: "POD",
      label: "POD",
      isRequired: true,
      blocksPayment: true,
    },
    {
      entityType: "TRUCK_ASSIGNMENT",
      documentType: "CARRIER_INVOICE",
      label: "Carrier Invoice",
      isRequired: true,
      blocksPayment: true,
    },
    {
      entityType: "CARRIER",
      documentType: "COI",
      label: "Certificate of Insurance",
      isRequired: true,
      blocksPayment: false,
    },
    {
      entityType: "CARRIER",
      documentType: "W9",
      label: "W-9",
      isRequired: true,
      blocksPayment: true,
    },
  ];

  for (const req of paperworkDefaults) {
    const existing = await prisma.complianceRequirement.findFirst({
      where: {
        entityType: req.entityType,
        documentType: req.documentType,
      },
    });
    if (!existing) {
      await prisma.complianceRequirement.create({ data: req });
    }
  }

  // Demo oilfield dataset (idempotent — only when no customers exist)
  const customerCount = await prisma.customer.count({ where: { deletedAt: null } });
  if (customerCount === 0) {
    const customer = await prisma.customer.create({
      data: {
        companyName: "Permian Pipe & Energy",
        dba: "PPE Midland",
        mainPhone: "432-555-0148",
        status: "ACTIVE",
        paymentTerms: "NET_30",
        billingCity: "Midland",
        billingState: "TX",
        notes: "Primary oilfield pipe customer — multi-truck casing/tubing hauls.",
        contacts: {
          create: [
            {
              name: "Jordan Hale",
              role: "Dispatcher",
              phone: "432-555-0199",
              email: "jordan.hale@ppe.example",
              isPrimary: true,
            },
            {
              name: "Sam Ortiz",
              role: "Accounts Payable",
              email: "ap@ppe.example",
            },
          ],
        },
        locations: {
          create: [
            {
              name: "Midland Pipe Yard",
              locationType: "Yard",
              city: "Midland",
              state: "TX",
              county: "Midland",
              directions: "Enter south gate off I-20 frontage. Check in at scale house.",
            },
            {
              name: "Rig #284 – Reeves County",
              locationType: "Rig",
              county: "Reeves",
              state: "TX",
              rigName: "Rig #284",
              rigNumber: "284",
              leaseName: "Sandstone Lease",
              wellName: "Sandstone 12H",
              gateInstructions: "Call field contact 30 min out. Lease roads soft after rain.",
              contactName: "Field Foreman Rick",
              contactPhone: "432-555-0177",
            },
          ],
        },
      },
    });

    const carrier = await prisma.carrier.create({
      data: {
        legalName: "West Texas Flatbed LLC",
        dba: "WTF Hauling",
        mcNumber: "MC-884422",
        usdotNumber: "USDOT-3344556",
        phone: "432-555-0110",
        email: "dispatch@wtfhauling.example",
        city: "Odessa",
        state: "TX",
        approvalStatus: "PREFERRED",
        status: "ACTIVE",
        paymentTerms: "NET_30",
      },
    });

    const driver = await prisma.driver.create({
      data: {
        firstName: "Miguel",
        lastName: "Ramos",
        phone: "432-555-0166",
        carrierId: carrier.id,
        driverType: "CARRIER",
        cdlNumber: "TX-D-998877",
        cdlState: "TX",
        cdlClass: "A",
        cdlExpiration: new Date("2027-06-01"),
        medicalCardExpiration: new Date("2026-12-15"),
        status: "AVAILABLE",
      },
    });

    await prisma.tractor.create({
      data: {
        unitNumber: "T-412",
        year: 2021,
        make: "Peterbilt",
        model: "579",
        carrierId: carrier.id,
        licensePlate: "KXM4521",
        licenseState: "TX",
        status: "AVAILABLE",
      },
    });

    await prisma.trailer.create({
      data: {
        unitNumber: "FB-88",
        trailerType: "FLATBED",
        lengthFeet: 48,
        axles: 3,
        maxPayloadLbs: 48000,
        carrierId: carrier.id,
        status: "AVAILABLE",
      },
    });

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const job = await prisma.job.create({
      data: {
        jobNumber: `JOB-${today.getFullYear()}-000001`,
        customerId: customer.id,
        customerPoNumber: "PO-77821",
        jobType: "PIPE",
        status: "PARTIALLY_ASSIGNED",
        pickupDate: today,
        pickupTime: "07:00",
        deliveryDate: today,
        deliveryTime: "15:00",
        pickupName: "Midland Pipe Yard",
        pickupCity: "Midland",
        pickupState: "TX",
        pickupCounty: "Midland",
        deliveryName: "Rig #284 – Reeves County",
        deliveryCounty: "Reeves",
        deliveryState: "TX",
        rigName: "Rig #284",
        rigNumber: "284",
        leaseName: "Sandstone Lease",
        wellName: "Sandstone 12H",
        fieldContactName: "Field Foreman Rick",
        fieldContactPhone: "432-555-0177",
        trucksRequired: 4,
        customerRate: 18600,
        billingMethod: "PER_TRUCK",
        specialInstructions: "Pipe tallies required. Soft straps only — no chains on coated pipe.",
        dispatcherId: admin.id,
        totalRevenue: 18600,
      },
    });

    const truck1 = await prisma.truckAssignment.create({
      data: {
        jobId: job.id,
        assignmentNumber: 1,
        displayId: "TRK-001",
        carrierId: carrier.id,
        driverId: driver.id,
        driverPhone: driver.phone,
        trailerType: "FLATBED",
        status: "ASSIGNED",
        pickupDate: today,
        pickupTime: "07:00",
        carrierRate: 1550,
        revenueAllocation: 4650,
        dispatcherId: admin.id,
      },
    });

    await prisma.cargoItem.createMany({
      data: [
        {
          truckAssignmentId: truck1.id,
          materialCategory: "CASING",
          materialDescription: '5.5" casing',
          pipeOutsideDiameterIn: 5.5,
          weightPerFoot: 36,
          totalFootage: 800,
          calculatedWeightLbs: 28800,
          numberOfJoints: 27,
          jointLengthFt: 30,
          sortOrder: 1,
        },
        {
          truckAssignmentId: truck1.id,
          materialCategory: "TUBING",
          materialDescription: '2.875" tubing',
          pipeOutsideDiameterIn: 2.875,
          weightPerFoot: 12,
          totalFootage: 300,
          calculatedWeightLbs: 3600,
          sortOrder: 2,
        },
      ],
    });

    await prisma.truckAssignment.update({
      where: { id: truck1.id },
      data: {
        totalFootage: 1100,
        totalWeightLbs: 32400,
        totalCost: 1550,
        profit: 3100,
        marginPercent: 66.6667,
      },
    });

    await prisma.truckAssignment.create({
      data: {
        jobId: job.id,
        assignmentNumber: 2,
        displayId: "TRK-002",
        status: "UNASSIGNED",
        pickupDate: today,
        pickupTime: "08:00",
        trailerType: "PIPE_TRAILER",
        dispatcherId: admin.id,
        cargoItems: {
          create: [
            {
              materialCategory: "CASING",
              materialDescription: '7" casing',
              pipeOutsideDiameterIn: 7,
              weightPerFoot: 44,
              totalFootage: 950,
              calculatedWeightLbs: 41800,
            },
          ],
        },
        totalFootage: 950,
        totalWeightLbs: 41800,
      },
    });

    await prisma.truckAssignment.createMany({
      data: [
        {
          jobId: job.id,
          assignmentNumber: 3,
          displayId: "TRK-003",
          status: "UNASSIGNED",
          pickupDate: today,
          pickupTime: "09:00",
          dispatcherId: admin.id,
        },
        {
          jobId: job.id,
          assignmentNumber: 4,
          displayId: "TRK-004",
          status: "UNASSIGNED",
          pickupDate: today,
          pickupTime: "10:00",
          dispatcherId: admin.id,
        },
      ],
    });

    await prisma.companySettings.updateMany({
      data: { nextJobSequence: 2 },
    });

    // Future job
    await prisma.job.create({
      data: {
        jobNumber: `JOB-${today.getFullYear()}-000002`,
        customerId: customer.id,
        jobType: "OILFIELD",
        status: "NEEDS_TRUCKS",
        pickupDate: tomorrow,
        pickupTime: "06:30",
        pickupName: "Midland Pipe Yard",
        pickupCity: "Midland",
        pickupState: "TX",
        deliveryName: "South Ranch Pad 3",
        deliveryCounty: "Upton",
        deliveryState: "TX",
        leaseName: "South Ranch",
        trucksRequired: 2,
        customerRate: 6200,
        billingMethod: "PER_TRUCK",
        dispatcherId: admin.id,
        trucks: {
          create: [
            {
              assignmentNumber: 1,
              displayId: "TRK-001",
              status: "UNASSIGNED",
              pickupDate: tomorrow,
              pickupTime: "06:30",
            },
            {
              assignmentNumber: 2,
              displayId: "TRK-002",
              status: "UNASSIGNED",
              pickupDate: tomorrow,
              pickupTime: "07:30",
            },
          ],
        },
      },
    });

    console.log("Demo oilfield data created (Permian Pipe & Energy / Job 000001).");
  }

  console.log("Seed complete.");
  console.log(`Admin user: ${admin.email} / admin123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
