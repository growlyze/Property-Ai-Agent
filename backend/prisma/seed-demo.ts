/**
 * Demo data for Growlyze Property AI Agent.
 *
 * Adds realistic, current-looking data on top of the base seed (prisma/seed.ts)
 * so dashboard screens look populated for a sales demo.
 *
 * Idempotent: every row this script creates has a deterministic id starting
 * with "demo-" (users are keyed by email, lead sources by source) and is
 * written with upsert, so re-running refreshes the rows instead of
 * duplicating them. Nothing created by other code is deleted.
 *
 * Run: npm run db:seed:demo   (from backend/)
 */
import { Prisma, PrismaClient, User } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const NOW = new Date();
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number, hour = 10): Date {
  const d = new Date(NOW.getTime() - n * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function daysFromNow(n: number, hour = 10): Date {
  return daysAgo(-n, hour);
}
/** First day of the month `monthsAgo` months before the current month, plus `dayOffset` days. */
function monthStart(monthsAgo: number, dayOffset = 0): Date {
  return new Date(NOW.getFullYear(), NOW.getMonth() - monthsAgo, 1 + dayOffset, 12, 0, 0);
}
function addMonths(d: Date, m: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + m, d.getDate(), 12, 0, 0);
}
function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}
function shortId(id: string): string {
  return id.slice(-8);
}

// ---------------------------------------------------------------------------
// Static demo content
// ---------------------------------------------------------------------------

const DEMO_TENANTS = [
  { email: "ava.patel@example.com", firstName: "Ava", lastName: "Patel", phone: "555-201-1001" },
  { email: "noah.thompson@example.com", firstName: "Noah", lastName: "Thompson", phone: "555-201-1002" },
  { email: "sophia.nguyen@example.com", firstName: "Sophia", lastName: "Nguyen", phone: "555-201-1003" },
  { email: "liam.oconnor@example.com", firstName: "Liam", lastName: "O'Connor", phone: "555-201-1004" },
  { email: "maya.rodriguez@example.com", firstName: "Maya", lastName: "Rodriguez", phone: "555-201-1005" },
  { email: "ethan.brooks@example.com", firstName: "Ethan", lastName: "Brooks", phone: "555-201-1006" },
  { email: "isabella.rossi@example.com", firstName: "Isabella", lastName: "Rossi", phone: "555-201-1007" },
  { email: "mason.clarke@example.com", firstName: "Mason", lastName: "Clarke", phone: "555-201-1008" },
];
/** How many of the demo tenants get a lease (the rest are applicants). */
const LEASED_DEMO_TENANTS = 5;

type MrSeed = {
  key: string;
  title: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
  createdDaysAgo: number;
  estimatedCost: number;
  actualCost?: number;
  vendor?: "GENERAL_MAINTENANCE" | "PLUMBING" | "ELECTRICAL";
  tenantIdx?: number; // index into demo tenants whose unit this request is for
};

const DEMO_MAINTENANCE: MrSeed[] = [
  { key: "mr-01", title: "Water heater not producing hot water", description: "Tenant reports only lukewarm water since the weekend. Unit is a 40-gallon gas heater installed in 2016.", status: "COMPLETED", priority: "HIGH", createdDaysAgo: 41, estimatedCost: 650, actualCost: 720, vendor: "PLUMBING" },
  { key: "mr-02", title: "Dishwasher leaking onto kitchen floor", description: "Small pool of water forms under the dishwasher after every cycle. Door gasket looks worn.", status: "COMPLETED", priority: "MEDIUM", createdDaysAgo: 33, estimatedCost: 220, actualCost: 185, vendor: "PLUMBING" },
  { key: "mr-03", title: "Bedroom outlets not working", description: "Two outlets in the main bedroom stopped working. Breaker was reset but they are still dead.", status: "COMPLETED", priority: "HIGH", createdDaysAgo: 27, estimatedCost: 300, actualCost: 275, vendor: "ELECTRICAL" },
  { key: "mr-04", title: "Front door lock sticking", description: "Deadbolt is very stiff and the key sometimes will not turn. Tenant is worried about getting locked out.", status: "IN_PROGRESS", priority: "MEDIUM", createdDaysAgo: 9, estimatedCost: 180, vendor: "GENERAL_MAINTENANCE", tenantIdx: 3 },
  { key: "mr-05", title: "Flickering lights in living room", description: "Ceiling fixture flickers intermittently, worse in the evening when the AC is running.", status: "IN_PROGRESS", priority: "MEDIUM", createdDaysAgo: 6, estimatedCost: 250, vendor: "ELECTRICAL" },
  { key: "mr-06", title: "Clogged kitchen drain", description: "Kitchen sink drains very slowly; tenant tried a plunger with no improvement.", status: "OPEN", priority: "MEDIUM", createdDaysAgo: 3, estimatedCost: 150, vendor: "PLUMBING", tenantIdx: 1 },
  { key: "mr-07", title: "Burst pipe under bathroom vanity", description: "Water spraying from supply line under the bathroom vanity. Tenant shut off the valve; water damage to cabinet base.", status: "IN_PROGRESS", priority: "EMERGENCY", createdDaysAgo: 1, estimatedCost: 900, vendor: "PLUMBING", tenantIdx: 0 },
  { key: "mr-08", title: "Patio sliding door off its track", description: "Sliding door to the patio jumped its track and will not close fully.", status: "OPEN", priority: "LOW", createdDaysAgo: 2, estimatedCost: 120 },
  { key: "mr-09", title: "Garbage disposal jammed", description: "Disposal hums but does not spin. Reset button did not help.", status: "OPEN", priority: "LOW", createdDaysAgo: 1, estimatedCost: 140 },
  { key: "mr-10", title: "Repaint hallway after move-in scuffs", description: "Scuff marks and a small dent along the hallway from move-in. Cosmetic only.", status: "ON_HOLD", priority: "LOW", createdDaysAgo: 18, estimatedCost: 400, vendor: "GENERAL_MAINTENANCE" },
  { key: "mr-11", title: "Thermostat display blank", description: "Smart thermostat screen is blank; heating does not come on. Batteries replaced by tenant.", status: "COMPLETED", priority: "HIGH", createdDaysAgo: 54, estimatedCost: 260, actualCost: 240, vendor: "ELECTRICAL" },
  { key: "mr-12", title: "Request for additional window screen", description: "Tenant asked for a screen on the second bedroom window. Not a repair; tenant withdrew the request.", status: "CANCELLED", priority: "LOW", createdDaysAgo: 22, estimatedCost: 60 },
];

// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding Growlyze demo data...");

  // ---- Lookups -------------------------------------------------------------
  const admin = await prisma.user.findUnique({ where: { email: "admin@growlyze.com" } });
  const sarah = await prisma.user.findUnique({ where: { email: "sarah.manager@growlyze.com" } });
  const michael = await prisma.user.findUnique({ where: { email: "michael.manager@growlyze.com" } });
  if (!admin || !sarah || !michael) {
    throw new Error("Base seed users not found. Run `npm run db:seed` first.");
  }
  const tenantRole = await prisma.role.findFirst({ where: { name: "TENANT" } });

  const vendors = await prisma.vendor.findMany({ orderBy: { email: "asc" } });
  if (vendors.length === 0) throw new Error("No vendors found. Run `npm run db:seed` first.");
  const vendorFor = (specialty?: string) =>
    vendors.find((v) => v.specialty === specialty) ?? vendors[0];

  // ---- Refresh base-seed leases --------------------------------------------
  // The base seed's leases are ACTIVE but ended in 2024–2025, so the demo
  // showed "active" leases already past their end date. Move any such
  // non-demo lease into a current term, staggering end dates (1–11 months
  // out) so "Leases ending soon" has something to show.
  const staleLeases = await prisma.lease.findMany({
    where: { status: "ACTIVE", endDate: { lt: new Date() }, NOT: { id: { startsWith: "demo-" } } },
    orderBy: { id: "asc" },
  });
  for (const [i, lease] of staleLeases.entries()) {
    const endDate = addMonths(new Date(), 1 + i * 2);
    await prisma.lease.update({
      where: { id: lease.id },
      data: { startDate: addMonths(endDate, -12), endDate },
    });
  }
  if (staleLeases.length) console.log(`Moved ${staleLeases.length} expired base-seed leases into a current term.`);

  // ---- Tenants -------------------------------------------------------------
  const passwordHash = await bcrypt.hash("Password123!", await bcrypt.genSalt(10));
  const demoTenants: User[] = [];
  for (const t of DEMO_TENANTS) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: { firstName: t.firstName, lastName: t.lastName, phone: t.phone, role: "TENANT", isActive: true },
      create: {
        email: t.email,
        password: passwordHash,
        firstName: t.firstName,
        lastName: t.lastName,
        phone: t.phone,
        role: "TENANT",
        isActive: true,
        lastLogin: daysAgo(2),
        ...(tenantRole ? { Role: { connect: { id: tenantRole.id } } } : {}),
      },
    });
    demoTenants.push(user);
  }
  console.log(`  tenants: ${demoTenants.length} upserted`);

  // ---- Leases --------------------------------------------------------------
  // Rentals with no lease (or with one of our demo leases) are candidates, in a
  // stable order so re-runs pick the same rentals.
  const rentals = await prisma.rental.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { Leases: { select: { id: true } } },
  });
  const freeRentals = rentals.filter(
    (r) => r.Leases.length === 0 || r.Leases.every((l) => l.id.startsWith("demo-"))
  );
  const leaseStartMonthsAgo = [14, 9, 7, 11, 8];
  for (let i = 0; i < Math.min(LEASED_DEMO_TENANTS, freeRentals.length); i++) {
    const rental = freeRentals[i];
    const tenant = demoTenants[i];
    const start = monthStart(leaseStartMonthsAgo[i]);
    const id = `demo-lease-${i + 1}`;
    const data: Prisma.LeaseUncheckedCreateInput = {
      id,
      rentalId: rental.id,
      tenantId: tenant.id,
      startDate: start,
      endDate: addMonths(start, leaseStartMonthsAgo[i] > 12 ? 24 : 12),
      rentAmount: rental.rent,
      securityDeposit: rental.deposit ?? rental.rent,
      leaseTerms: "12-month residential lease. Rent due on the 1st; 5-day grace period; $75 late fee.",
      status: "ACTIVE",
      signedDate: addMonths(start, 0),
    };
    // A rental can only have one lease (rentalId is unique). If this rental is
    // held by a different demo lease from an earlier run, the upsert by id
    // below still works because ids are assigned in the same order.
    await prisma.lease.upsert({ where: { id }, create: data, update: data });
    await prisma.rental.update({ where: { id: rental.id }, data: { isAvailable: false } });
  }
  const vacantRentals = freeRentals.slice(LEASED_DEMO_TENANTS);
  console.log(`  leases: ${Math.min(LEASED_DEMO_TENANTS, freeRentals.length)} demo leases; ${vacantRentals.length} rental(s) left vacant`);

  const activeLeases = await prisma.lease.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { Rental: true, User: true },
  });

  // ---- Rent payments (transactions) ----------------------------------------
  // 6 months per active lease. Mostly COMPLETED, some PENDING for the current
  // month, a few FAILED and one PENDING from last month (shows as overdue).
  let txCount = 0;
  for (let li = 0; li < activeLeases.length; li++) {
    const lease = activeLeases[li];
    for (let m = 5; m >= 0; m--) {
      let status: "COMPLETED" | "PENDING" | "FAILED" = "COMPLETED";
      if (m === 0 && li % 3 === 2) status = "PENDING";
      if ((li === 1 && m === 1) || (li === 4 && m === 0) || (li === 7 && m === 2)) status = "FAILED";
      if (li === 9 && m === 1) status = "PENDING"; // overdue
      const date = monthStart(m, status === "COMPLETED" ? li % 5 : 0);
      const id = `demo-tx-${lease.id}-m${m}`;
      const data: Prisma.TransactionUncheckedCreateInput = {
        id,
        leaseId: lease.id,
        amount: lease.rentAmount,
        type: "RENT_PAYMENT",
        status,
        description: `Rent payment - ${monthLabel(monthStart(m))} - ${lease.Rental.title}`,
        transactionDate: date,
        createdAt: date,
        approvedById: status === "COMPLETED" ? sarah.id : null,
      };
      await prisma.transaction.upsert({ where: { id }, create: data, update: data });
      txCount++;
    }
    // Late fee where a payment failed
    if (li === 1 || li === 4 || li === 7) {
      const id = `demo-tx-${lease.id}-latefee`;
      const date = monthStart(li === 4 ? 0 : li === 1 ? 1 : 2, 6);
      const data: Prisma.TransactionUncheckedCreateInput = {
        id,
        leaseId: lease.id,
        amount: 75,
        type: "OTHER",
        status: li === 4 ? "PENDING" : "COMPLETED",
        description: `Late fee - ${monthLabel(date)}`,
        transactionDate: date,
        createdAt: date,
        approvedById: li === 4 ? null : sarah.id,
      };
      await prisma.transaction.upsert({ where: { id }, create: data, update: data });
      txCount++;
    }
  }
  // Security deposits for the new demo leases
  const demoLeases = activeLeases.filter((l) => l.id.startsWith("demo-lease-"));
  for (const lease of demoLeases) {
    const id = `demo-tx-${lease.id}-deposit`;
    const data: Prisma.TransactionUncheckedCreateInput = {
      id,
      leaseId: lease.id,
      amount: lease.securityDeposit,
      type: "SECURITY_DEPOSIT",
      status: "COMPLETED",
      description: `Security deposit - ${lease.Rental.title}`,
      transactionDate: lease.signedDate,
      createdAt: lease.signedDate,
      approvedById: michael.id,
    };
    await prisma.transaction.upsert({ where: { id }, create: data, update: data });
    txCount++;
  }
  console.log(`  transactions: ${txCount}`);

  // ---- Applications, screening, risk, background checks --------------------
  const tenantByEmail = (email: string) => demoTenants.find((t) => t.email === email)!;
  const leaseOf = (email: string) => demoLeases.find((l) => l.tenantId === tenantByEmail(email).id);
  const vacant = vacantRentals[0] ?? rentals[rentals.length - 1];
  const fallbackRental = (email: string) => leaseOf(email)?.rentalId ?? vacant.id;

  const applications: Array<{
    key: string;
    email: string;
    rentalId: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
    appliedDaysAgo: number;
    notes: string;
    creditScore: number;
    monthlyIncome: number;
    riskScore: number; // 0-100, higher = riskier
    riskLevel: "low" | "medium" | "high";
    recommendation: string;
    screening: "COMPLETED" | "IN_PROGRESS" | "PENDING";
    background: "CLEAR" | "REVIEW_REQUIRED" | "PENDING" | "FLAGGED";
    factors: string[];
  }> = [
    { key: "app-1", email: "ethan.brooks@example.com", rentalId: vacant.id, status: "PENDING", appliedDaysAgo: 4, notes: "Software engineer relocating for work. Requested a mid-December move-in.", creditScore: 742, monthlyIncome: 11800, riskScore: 18, riskLevel: "low", recommendation: "APPROVE", screening: "COMPLETED", background: "CLEAR", factors: ["Strong credit history", "Income 3.6x rent", "No prior evictions"] },
    { key: "app-2", email: "isabella.rossi@example.com", rentalId: vacant.id, status: "PENDING", appliedDaysAgo: 2, notes: "Small-business owner; provided two years of tax returns.", creditScore: 688, monthlyIncome: 9400, riskScore: 42, riskLevel: "medium", recommendation: "APPROVE_WITH_CONDITIONS", screening: "IN_PROGRESS", background: "PENDING", factors: ["Self-employed income varies month to month", "Income 2.9x rent", "One late credit-card payment in 24 months"] },
    { key: "app-3", email: "mason.clarke@example.com", rentalId: vacant.id, status: "PENDING", appliedDaysAgo: 1, notes: "Applying with a guarantor. Awaiting employment verification.", creditScore: 604, monthlyIncome: 6100, riskScore: 71, riskLevel: "high", recommendation: "REQUIRE_GUARANTOR", screening: "PENDING", background: "REVIEW_REQUIRED", factors: ["Credit score below 620", "Income 1.9x rent", "Collections account from 2023"] },
    { key: "app-4", email: "ava.patel@example.com", rentalId: fallbackRental("ava.patel@example.com"), status: "APPROVED", appliedDaysAgo: 430, notes: "Approved. Lease signed.", creditScore: 781, monthlyIncome: 10200, riskScore: 12, riskLevel: "low", recommendation: "APPROVE", screening: "COMPLETED", background: "CLEAR", factors: ["Excellent credit", "Stable employment 6+ years", "Positive landlord reference"] },
    { key: "app-5", email: "noah.thompson@example.com", rentalId: fallbackRental("noah.thompson@example.com"), status: "APPROVED", appliedDaysAgo: 285, notes: "Approved with standard deposit.", creditScore: 715, monthlyIncome: 9000, riskScore: 27, riskLevel: "low", recommendation: "APPROVE", screening: "COMPLETED", background: "CLEAR", factors: ["Good credit", "Income 3.3x rent"] },
    { key: "app-6", email: "mason.clarke@example.com", rentalId: fallbackRental("sophia.nguyen@example.com"), status: "REJECTED", appliedDaysAgo: 220, notes: "Declined: income below 2.5x rent requirement and an unresolved prior-landlord balance.", creditScore: 571, monthlyIncome: 5200, riskScore: 84, riskLevel: "high", recommendation: "DECLINE", screening: "COMPLETED", background: "FLAGGED", factors: ["Outstanding balance with previous landlord", "Income 1.6x rent", "Credit score below 600"] },
    { key: "app-7", email: "isabella.rossi@example.com", rentalId: fallbackRental("liam.oconnor@example.com"), status: "WITHDRAWN", appliedDaysAgo: 350, notes: "Applicant withdrew; found a unit closer to work.", creditScore: 695, monthlyIncome: 8800, riskScore: 38, riskLevel: "medium", recommendation: "APPROVE_WITH_CONDITIONS", screening: "COMPLETED", background: "CLEAR", factors: ["Self-employed", "Income 2.8x rent"] },
  ];

  for (const a of applications) {
    const applicant = tenantByEmail(a.email);
    const id = `demo-${a.key}`;
    const applied = daysAgo(a.appliedDaysAgo);
    // (rentalId, applicantId) is unique: skip if a non-demo application already uses the pair.
    const clash = await prisma.application.findFirst({
      where: { rentalId: a.rentalId, applicantId: applicant.id, NOT: { id } },
    });
    if (clash) continue;
    const appData: Prisma.ApplicationUncheckedCreateInput = {
      id,
      rentalId: a.rentalId,
      applicantId: applicant.id,
      status: a.status,
      notes: a.notes,
      appliedDate: applied,
      createdAt: applied,
    };
    await prisma.application.upsert({ where: { id }, create: appData, update: appData });

    const scrId = `demo-screening-${a.key}`;
    const scrData: Prisma.ScreeningUncheckedCreateInput = {
      id: scrId,
      applicationId: id,
      status: a.screening,
      reportUrl: a.screening === "COMPLETED" ? `https://example.com/reports/screening-${a.key}.pdf` : null,
      createdAt: daysAgo(a.appliedDaysAgo - 1 > 0 ? a.appliedDaysAgo - 1 : 0),
    };
    await prisma.screening.upsert({ where: { id: scrId }, create: scrData, update: scrData });

    const riskId = `demo-risk-${a.key}`;
    const riskData: Prisma.RiskAssessmentUncheckedCreateInput = {
      id: riskId,
      applicationId: id,
      score: a.riskScore,
      details: {
        applicantName: `${applicant.firstName} ${applicant.lastName}`,
        riskLevel: a.riskLevel,
        creditScore: a.creditScore,
        monthlyIncome: a.monthlyIncome,
        recommendation: a.recommendation,
        confidence: 86,
        factors: a.factors,
        model: "growlyze-risk-v2",
      },
      createdAt: applied,
    };
    await prisma.riskAssessment.upsert({ where: { id: riskId }, create: riskData, update: riskData });

    const bgId = `demo-bg-${a.key}`;
    // BackgroundCheck.applicantId is a unique FK to Application.id (despite its name).
    const bgData: Prisma.BackgroundCheckUncheckedCreateInput = {
      id: bgId,
      applicantId: id,
      status: a.background,
      reportUrl: a.background === "PENDING" ? null : `https://example.com/reports/background-${a.key}.pdf`,
      createdAt: applied,
    };
    await prisma.backgroundCheck.upsert({ where: { id: bgId }, create: bgData, update: bgData });
  }
  console.log(`  applications: ${applications.length} (with screening, risk, background check)`);

  // ---- Maintenance requests, work orders, quotes, ratings, payments ---------
  const leasedForMr = activeLeases.length > 0 ? activeLeases : [];
  const mrIds: Record<string, string> = {};
  for (let i = 0; i < DEMO_MAINTENANCE.length; i++) {
    const s = DEMO_MAINTENANCE[i];
    const lease =
      (s.tenantIdx !== undefined ? demoLeases.find((l) => l.tenantId === demoTenants[s.tenantIdx!].id) : undefined) ??
      leasedForMr[(i * 3) % leasedForMr.length];
    const created = daysAgo(s.createdDaysAgo, 9 + (i % 6));
    const id = `demo-${s.key}`;
    mrIds[s.key] = id;
    const data: Prisma.MaintenanceRequestUncheckedCreateInput = {
      id,
      title: s.title,
      description: s.description,
      status: s.status,
      priority: s.priority,
      createdAt: created,
      scheduledDate:
        s.status === "COMPLETED" ? new Date(created.getTime() + 2 * DAY)
        : s.status === "IN_PROGRESS" || s.status === "OPEN" ? daysFromNow(1 + (i % 4))
        : null,
      completedDate: s.status === "COMPLETED" ? new Date(created.getTime() + 4 * DAY) : null,
      notes: s.status === "CANCELLED" ? "Cancelled at tenant's request." : s.vendor ? `Assigned to ${vendorFor(s.vendor).name}.` : null,
      estimatedCost: s.estimatedCost,
      actualCost: s.actualCost ?? null,
      rentalId: lease.rentalId,
      requestedById: lease.tenantId,
    };
    await prisma.maintenanceRequest.upsert({ where: { id }, create: data, update: data });
  }

  let woCount = 0;
  for (let i = 0; i < DEMO_MAINTENANCE.length; i++) {
    const s = DEMO_MAINTENANCE[i];
    if (!s.vendor) continue;
    const vendor = vendorFor(s.vendor);
    const created = daysAgo(s.createdDaysAgo - 0.2);
    const woStatus =
      s.status === "COMPLETED" ? "COMPLETED"
      : s.status === "IN_PROGRESS" ? "IN_PROGRESS"
      : s.status === "ON_HOLD" ? "ON_HOLD"
      : "ASSIGNED";
    const woId = `demo-wo-${s.key}`;
    const woData: Prisma.WorkOrderUncheckedCreateInput = {
      id: woId,
      title: `WO: ${s.title}`,
      description: s.description,
      status: woStatus,
      priority: s.priority,
      createdAt: created,
      completedAt: s.status === "COMPLETED" ? new Date(created.getTime() + 4 * DAY) : null,
      maintenanceRequestId: mrIds[s.key],
    };
    await prisma.workOrder.upsert({ where: { id: woId }, create: woData, update: woData });
    woCount++;

    const asgId = `demo-woa-${s.key}`;
    const asgData: Prisma.WorkOrderAssignmentUncheckedCreateInput = {
      id: asgId,
      workOrderId: woId,
      vendorId: vendor.id,
      assignedAt: created,
      notes: `Assigned by ${sarah.firstName} ${sarah.lastName}`,
    };
    await prisma.workOrderAssignment.upsert({ where: { id: asgId }, create: asgData, update: asgData });

    // Quotes: accepted quote from the assigned vendor; a competing quote on bigger jobs.
    const qId = `demo-woq-${s.key}-1`;
    const qData: Prisma.WorkOrderQuoteUncheckedCreateInput = {
      id: qId,
      workOrderId: woId,
      vendorId: vendor.id,
      amount: s.actualCost ?? s.estimatedCost,
      details: "Parts and labour included. 90-day workmanship warranty.",
      status: s.status === "OPEN" ? "PENDING" : "ACCEPTED",
      createdAt: created,
    };
    await prisma.workOrderQuote.upsert({ where: { id: qId }, create: qData, update: qData });
    if (s.estimatedCost >= 250) {
      const other = vendors.find((v) => v.id !== vendor.id) ?? vendor;
      const q2Id = `demo-woq-${s.key}-2`;
      const q2Data: Prisma.WorkOrderQuoteUncheckedCreateInput = {
        id: q2Id,
        workOrderId: woId,
        vendorId: other.id,
        amount: Math.round(s.estimatedCost * 1.25),
        details: "Alternative quote. Earliest availability next week.",
        status: s.status === "OPEN" ? "PENDING" : "REJECTED",
        createdAt: created,
      };
      await prisma.workOrderQuote.upsert({ where: { id: q2Id }, create: q2Data, update: q2Data });
    }

    if (s.status === "COMPLETED") {
      const done = new Date(created.getTime() + 4 * DAY);
      const rId = `demo-vpr-${s.key}`;
      const rating = [5, 4, 5, 4][i % 4];
      const rData: Prisma.VendorPerformanceRatingUncheckedCreateInput = {
        id: rId,
        vendorId: vendor.id,
        workOrderId: woId,
        ratedById: i % 2 === 0 ? sarah.id : michael.id,
        rating,
        comment: rating === 5 ? "Arrived on time, explained the fix clearly and left the unit clean." : "Good work; needed a second visit for a missing part.",
        createdAt: done,
      };
      await prisma.vendorPerformanceRating.upsert({ where: { id: rId }, create: rData, update: rData });

      const pId = `demo-vpay-${s.key}`;
      const pData: Prisma.VendorPaymentUncheckedCreateInput = {
        id: pId,
        workOrderId: woId,
        vendorId: vendor.id,
        amount: s.actualCost ?? s.estimatedCost,
        status: s.createdDaysAgo > 30 ? "PAID" : "APPROVED",
        approvedById: admin.id,
        paymentDate: new Date(done.getTime() + 3 * DAY),
        createdAt: done,
      };
      await prisma.vendorPayment.upsert({ where: { id: pId }, create: pData, update: pData });
    }

    if (s.status === "IN_PROGRESS" || s.status === "OPEN") {
      const evId = `demo-event-${s.key}`;
      const start = daysFromNow(1 + (i % 4), 9 + (i % 5));
      const evData: Prisma.ScheduledEventUncheckedCreateInput = {
        id: evId,
        workOrderId: woId,
        title: `${vendor.name}: ${s.title}`,
        description: s.description,
        startTime: start,
        endTime: new Date(start.getTime() + 2 * 60 * 60 * 1000),
        location: "On site",
      };
      await prisma.scheduledEvent.upsert({ where: { id: evId }, create: evData, update: evData });
    }
  }
  // One pending payment for in-progress emergency work (deposit for parts)
  {
    const woId = `demo-wo-mr-07`;
    const pId = `demo-vpay-mr-07-parts`;
    const pData: Prisma.VendorPaymentUncheckedCreateInput = {
      id: pId,
      workOrderId: woId,
      vendorId: vendorFor("PLUMBING").id,
      amount: 300,
      status: "PENDING",
      paymentDate: daysFromNow(2),
      createdAt: daysAgo(0),
    };
    await prisma.vendorPayment.upsert({ where: { id: pId }, create: pData, update: pData });
  }
  console.log(`  maintenance requests: ${DEMO_MAINTENANCE.length}, work orders: ${woCount}`);

  // ---- Tenant ratings --------------------------------------------------------
  const ratingSeeds = [
    { c: { cleanliness: 5, communication: 5, paymentHistory: 5, propertyCare: 4 }, tags: ["on-time payer", "great communicator"], comment: "Model tenant. Always pays early and reports issues promptly." },
    { c: { cleanliness: 4, communication: 4, paymentHistory: 3, propertyCare: 4 }, tags: ["occasional late payment"], comment: "Generally good; one failed payment this quarter, resolved within a week." },
    { c: { cleanliness: 5, communication: 4, paymentHistory: 5, propertyCare: 5 }, tags: ["well maintained unit"], comment: "Unit was spotless at the mid-lease inspection." },
    { c: { cleanliness: 3, communication: 4, paymentHistory: 4, propertyCare: 3 }, tags: ["minor wear"], comment: "Some wall scuffs noted at inspection; tenant agreed to touch-up." },
    { c: { cleanliness: 4, communication: 5, paymentHistory: 5, propertyCare: 4 }, tags: ["renewal candidate"], comment: "Strong candidate for renewal at market rate." },
    { c: { cleanliness: 4, communication: 3, paymentHistory: 4, propertyCare: 4 }, tags: [], comment: "Slow to respond to inspection scheduling but otherwise fine." },
  ];
  for (let i = 0; i < Math.min(ratingSeeds.length, activeLeases.length); i++) {
    const lease = activeLeases[i];
    const s = ratingSeeds[i];
    const vals = Object.values(s.c);
    const overall = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    const id = `demo-trating-${i + 1}`;
    const data: Prisma.TenantRatingUncheckedCreateInput = {
      id,
      leaseId: lease.id,
      tenantId: lease.tenantId,
      raterId: i % 2 === 0 ? sarah.id : michael.id,
      rating: Math.round(overall),
      overallRating: overall,
      categories: s.c,
      tags: s.tags,
      attachments: [],
      comment: s.comment,
      createdAt: daysAgo(10 + i * 7),
    };
    await prisma.tenantRating.upsert({ where: { id }, create: data, update: data });
  }
  console.log(`  tenant ratings: ${Math.min(ratingSeeds.length, activeLeases.length)}`);

  // ---- Notifications ---------------------------------------------------------
  const firstTenantLease = activeLeases[0];
  const notifSeeds: Array<{ userId: string; type: string; message: string; link?: string; isRead: boolean; ago: number }> = [
    { userId: sarah.id, type: "MAINTENANCE", message: "Emergency: burst pipe reported under bathroom vanity.", link: "/maintenance", isRead: false, ago: 1 },
    { userId: sarah.id, type: "PAYMENT", message: "A rent payment failed this month. Tenant has been notified.", link: "/payments", isRead: false, ago: 2 },
    { userId: sarah.id, type: "APPLICATION", message: "New rental application from Ethan Brooks.", link: "/applications", isRead: false, ago: 4 },
    { userId: sarah.id, type: "APPLICATION", message: "New rental application from Isabella Rossi.", link: "/applications", isRead: true, ago: 2 },
    { userId: michael.id, type: "APPLICATION", message: "Mason Clarke's application flagged as high risk by the AI risk model.", link: "/risk-assessment", isRead: false, ago: 1 },
    { userId: michael.id, type: "LEASE", message: "2 leases are due for renewal in the next 60 days.", link: "/leases", isRead: false, ago: 3 },
    { userId: michael.id, type: "VENDOR", message: "Mike Plumber submitted a quote for the clogged kitchen drain.", link: "/work-orders", isRead: true, ago: 3 },
    { userId: admin.id, type: "SYSTEM", message: "Monthly financial report for last month is ready.", link: "/financial-reports", isRead: true, ago: 20 },
    { userId: admin.id, type: "PAYMENT", message: "Vendor payment awaiting approval: $300 parts deposit.", link: "/vendor-payments", isRead: false, ago: 0 },
    ...demoTenants.slice(0, LEASED_DEMO_TENANTS).flatMap((t, i) => [
      { userId: t.id, type: "PAYMENT", message: "Your rent for this month is due on the 1st.", link: "/payments", isRead: i % 2 === 0, ago: 25 },
      { userId: t.id, type: "MAINTENANCE", message: "Your maintenance request has been scheduled.", link: "/maintenance", isRead: i % 3 === 0, ago: 2 + i },
    ]),
    ...(firstTenantLease
      ? [{ userId: firstTenantLease.tenantId, type: "PAYMENT", message: "Payment received. Thank you!", link: "/payments", isRead: false, ago: 22 }]
      : []),
  ];
  for (let i = 0; i < notifSeeds.length; i++) {
    const n = notifSeeds[i];
    const id = `demo-notif-${i + 1}`;
    const data: Prisma.NotificationUncheckedCreateInput = {
      id,
      userId: n.userId,
      type: n.type,
      message: n.message,
      link: n.link ?? null,
      isRead: n.isRead,
      createdAt: daysAgo(n.ago, 8 + (i % 10)),
    };
    await prisma.notification.upsert({ where: { id }, create: data, update: data });
  }
  console.log(`  notifications: ${notifSeeds.length}`);

  // ---- Messages --------------------------------------------------------------
  type MsgSeed = { from: string; to: string; content: string; ago: number; read: boolean; sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL"; score: number; category?: string; warn?: boolean; mr?: string };
  const conv = (tenantIdx: number, manager: { id: string }): MsgSeed[] => {
    const t = demoTenants[tenantIdx];
    const sets: MsgSeed[][] = [
      [
        { from: t.id, to: manager.id, content: "Hi, there's water coming from under the bathroom sink. I've shut the valve off.", ago: 1.2, read: true, sentiment: "NEGATIVE", score: -0.6, category: "plumbing", warn: true, mr: "mr-07" },
        { from: manager.id, to: t.id, content: "Thanks for acting quickly. A plumber is on the way and should arrive within two hours.", ago: 1.15, read: true, sentiment: "POSITIVE", score: 0.5, category: "plumbing", mr: "mr-07" },
        { from: t.id, to: manager.id, content: "He's here now. Thank you for the fast response!", ago: 1.0, read: false, sentiment: "POSITIVE", score: 0.8, category: "plumbing", mr: "mr-07" },
      ],
      [
        { from: t.id, to: manager.id, content: "My payment didn't go through this month. My bank changed my card number. Can I pay by bank transfer?", ago: 5, read: true, sentiment: "NEUTRAL", score: -0.1, category: "payment" },
        { from: manager.id, to: t.id, content: "No problem. You can update your payment method in the tenant portal under Payments. The late fee will be waived this time.", ago: 4.8, read: true, sentiment: "POSITIVE", score: 0.6, category: "payment" },
      ],
      [
        { from: t.id, to: manager.id, content: "Is it possible to renew my lease for another 12 months? I'd like to stay.", ago: 8, read: true, sentiment: "POSITIVE", score: 0.7, category: "lease" },
        { from: manager.id, to: t.id, content: "Great to hear! I'll send renewal terms this week.", ago: 7.5, read: false, sentiment: "POSITIVE", score: 0.6, category: "lease" },
      ],
      [
        { from: t.id, to: manager.id, content: "The front door lock is getting harder to turn every day. I'm worried I'll get locked out.", ago: 9, read: true, sentiment: "NEGATIVE", score: -0.4, category: "security", mr: "mr-04" },
        { from: manager.id, to: t.id, content: "We've booked a locksmith for this week. I'll confirm the time shortly.", ago: 8.8, read: true, sentiment: "NEUTRAL", score: 0.2, category: "security", mr: "mr-04" },
      ],
      [
        { from: t.id, to: manager.id, content: "Neighbours upstairs have been very loud after midnight for the past week.", ago: 3, read: false, sentiment: "NEGATIVE", score: -0.7, category: "noise", warn: true },
      ],
    ];
    return sets[tenantIdx % sets.length];
  };
  const allMsgs: Array<MsgSeed & { convId: string }> = [];
  for (let i = 0; i < LEASED_DEMO_TENANTS; i++) {
    const manager = i % 2 === 0 ? sarah : michael;
    for (const m of conv(i, manager)) allMsgs.push({ ...m, convId: `demo-conv-${i + 1}` });
  }
  for (let i = 0; i < allMsgs.length; i++) {
    const m = allMsgs[i];
    const id = `demo-msg-${i + 1}`;
    const sent = new Date(NOW.getTime() - m.ago * DAY);
    const data: Prisma.MessageUncheckedCreateInput = {
      id,
      content: m.content,
      senderId: m.from,
      receiverId: m.to,
      conversationId: m.convId,
      maintenanceRequestId: m.mr ? mrIds[m.mr] : null,
      sentAt: sent,
      readAt: m.read ? new Date(sent.getTime() + 30 * 60 * 1000) : null,
      sentiment: m.sentiment,
      sentimentScore: m.score,
      category: m.category ?? null,
      isEarlyWarning: m.warn ?? false,
    };
    await prisma.message.upsert({ where: { id }, create: data, update: data });
  }
  console.log(`  messages: ${allMsgs.length}`);

  // ---- Documents -------------------------------------------------------------
  const docs: Prisma.DocumentUncheckedCreateInput[] = [];
  demoLeases.forEach((l, i) => {
    const slug = (l.Rental.unitNumber ?? String(i + 1)).toLowerCase().replace(/\s+/g, "-");
    docs.push({
      id: `demo-doc-lease-${i + 1}`,
      name: `Lease Agreement - ${l.Rental.title}.pdf`,
      type: "LEASE",
      url: `https://example.com/docs/lease-${slug}.pdf`,
      description: `Signed lease for ${l.User.firstName} ${l.User.lastName}`,
      rentalId: l.rentalId,
      leaseId: l.id,
      uploadedById: sarah.id,
      size: 248_000 + i * 3_100,
      mimeType: "application/pdf",
      uploadedAt: l.signedDate,
    });
  });
  activeLeases.slice(0, 3).forEach((l, i) => {
    docs.push({
      id: `demo-doc-inspection-${i + 1}`,
      name: `Mid-lease Inspection Report - ${l.Rental.title}.pdf`,
      type: "MAINTENANCE_REPORT",
      url: `https://example.com/docs/inspection-${shortId(l.rentalId)}.pdf`,
      description: "Routine inspection with photos. No major issues found.",
      rentalId: l.rentalId,
      leaseId: l.id,
      uploadedById: michael.id,
      size: 1_420_000 + i * 51_000,
      mimeType: "application/pdf",
      uploadedAt: daysAgo(14 + i * 9),
    });
  });
  docs.push(
    {
      id: "demo-doc-invoice-mr-01",
      name: "Invoice - Water heater replacement.pdf",
      type: "INVOICE",
      url: "https://example.com/docs/invoice-water-heater.pdf",
      description: "Vendor invoice for water heater repair.",
      maintenanceRequestId: mrIds["mr-01"],
      uploadedById: admin.id,
      size: 96_000,
      mimeType: "application/pdf",
      uploadedAt: daysAgo(36),
    },
    {
      id: "demo-doc-receipt-mr-03",
      name: "Receipt - Bedroom outlet repair.pdf",
      type: "RECEIPT",
      url: "https://example.com/docs/receipt-outlet-repair.pdf",
      maintenanceRequestId: mrIds["mr-03"],
      uploadedById: admin.id,
      size: 54_000,
      mimeType: "application/pdf",
      uploadedAt: daysAgo(22),
    },
    {
      id: "demo-doc-contract-vendor",
      name: "Master Service Agreement - Plumbing.pdf",
      type: "CONTRACT",
      url: "https://example.com/docs/msa-plumbing.pdf",
      description: "Annual service agreement with preferred plumbing vendor.",
      uploadedById: admin.id,
      size: 310_000,
      mimeType: "application/pdf",
      uploadedAt: daysAgo(120),
    }
  );
  for (const d of docs) {
    await prisma.document.upsert({ where: { id: d.id! }, create: d, update: d });
  }
  console.log(`  documents: ${docs.length}`);

  // ---- Marketing -------------------------------------------------------------
  const campaigns: Prisma.MarketingCampaignCreateInput[] = [
    {
      id: "demo-campaign-1", name: "Winter Move-In Special", type: "GOOGLE_ADS", status: "ACTIVE",
      budget: 3500, spent: 2140, impressions: 48200, clicks: 1630, leads: 64,
      startDate: daysAgo(30), endDate: daysFromNow(45),
      description: "Search ads for 1-2 bedroom units with one month free on 13-month leases.",
      targetAudience: { ageRange: "25-40", radiusMiles: 15, interests: ["apartments", "relocation"] },
    },
    {
      id: "demo-campaign-2", name: "Bayview Condos Instagram Tour", type: "INSTAGRAM", status: "ACTIVE",
      budget: 1800, spent: 960, impressions: 71500, clicks: 2210, leads: 38,
      startDate: daysAgo(18), endDate: daysFromNow(26),
      description: "Short video tours of renovated condo units.",
      targetAudience: { ageRange: "22-35", interests: ["city living", "waterfront"] },
    },
    {
      id: "demo-campaign-3", name: "Resident Referral Email", type: "EMAIL", status: "COMPLETED",
      budget: 400, spent: 400, impressions: 1200, clicks: 310, leads: 21,
      startDate: daysAgo(90), endDate: daysAgo(30),
      description: "Email to current residents promoting the referral bonus.",
      targetAudience: { segment: "current residents" },
    },
    {
      id: "demo-campaign-4", name: "Tech Plaza Office Suites", type: "ZILLOW", status: "PAUSED",
      budget: 2500, spent: 730, impressions: 15800, clicks: 420, leads: 9,
      startDate: daysAgo(45), endDate: daysFromNow(15),
      description: "Commercial listing promotion for small-office suites.",
    },
  ];
  for (const c of campaigns) {
    await prisma.marketingCampaign.upsert({ where: { id: c.id! }, create: c, update: c });
  }

  const promotions: Prisma.PromotionCreateInput[] = [
    {
      id: "demo-promo-1", name: "One Month Free", type: "FREE_MONTH", status: "ACTIVE", code: "DEMO-WINTER1MO",
      discountType: "FIXED_AMOUNT", discountValue: 2500, description: "First month free on any 13-month lease.",
      startDate: daysAgo(30), endDate: daysFromNow(45), usageLimit: 10, usageCount: 3,
      terms: "New leases only. Applied as a credit to month two.",
    },
    {
      id: "demo-promo-2", name: "Resident Referral Bonus", type: "REFERRAL", status: "ACTIVE", code: "DEMO-REFER250",
      discountType: "FIXED_AMOUNT", discountValue: 250, description: "$250 rent credit for referring a new resident.",
      startDate: daysAgo(120), endDate: daysFromNow(240), usageLimit: null, usageCount: 7,
    },
    {
      id: "demo-promo-3", name: "Half Deposit", type: "REDUCED_DEPOSIT", status: "ACTIVE", code: "DEMO-HALFDEP",
      discountType: "PERCENTAGE", discountValue: 50, description: "50% off the security deposit for applicants with credit above 720.",
      startDate: daysAgo(10), endDate: daysFromNow(60), usageLimit: 5, usageCount: 1,
    },
    {
      id: "demo-promo-4", name: "Early Bird Summer", type: "EARLY_BIRD", status: "EXPIRED", code: "DEMO-EARLYSUMMER",
      discountType: "PERCENTAGE", discountValue: 10, description: "10% off first three months for early summer move-ins.",
      startDate: daysAgo(200), endDate: daysAgo(110), usageLimit: 20, usageCount: 14,
    },
  ];
  for (const p of promotions) {
    await prisma.promotion.upsert({ where: { id: p.id! }, create: p, update: p });
  }

  const leadSources = [
    { source: "Google Ads", leads: 64, cost: 2140, conversion: 0.11 },
    { source: "Instagram", leads: 38, cost: 960, conversion: 0.08 },
    { source: "Zillow", leads: 29, cost: 730, conversion: 0.14 },
    { source: "Resident Referral", leads: 21, cost: 400, conversion: 0.29 },
    { source: "Website", leads: 47, cost: 0, conversion: 0.12 },
    { source: "Walk-in", leads: 8, cost: 0, conversion: 0.38 },
  ];
  for (const l of leadSources) {
    await prisma.leadSource.upsert({ where: { source: l.source }, create: l, update: l });
  }
  console.log(`  marketing: ${campaigns.length} campaigns, ${promotions.length} promotions, ${leadSources.length} lead sources`);

  // ---- Light AI / ops extras (no complex relations) --------------------------
  const kb = [
    { q: "When is rent due?", a: "Rent is due on the 1st of each month. There is a 5-day grace period, after which a $75 late fee applies.", cat: "payments", kw: ["rent", "due", "late fee"] },
    { q: "How do I submit a maintenance request?", a: "Open the tenant portal, choose Maintenance, then New Request. Add photos if you can. Emergencies should also be phoned in.", cat: "maintenance", kw: ["maintenance", "repair", "request"] },
    { q: "What counts as a maintenance emergency?", a: "Active water leaks, gas smells, no heat in winter, electrical sparking, or a security issue such as a broken entry lock.", cat: "maintenance", kw: ["emergency", "leak", "gas"] },
    { q: "Can I renew my lease?", a: "Yes. Renewal offers are sent 60-90 days before your lease ends. Reply to the offer or message your property manager.", cat: "leasing", kw: ["renew", "lease", "renewal"] },
    { q: "Are pets allowed?", a: "Most units allow up to two pets with a pet deposit. Check your lease addendum or ask your property manager.", cat: "policies", kw: ["pets", "dog", "cat"] },
  ];
  for (let i = 0; i < kb.length; i++) {
    const id = `demo-kb-${i + 1}`;
    const data: Prisma.KnowledgeBaseEntryCreateInput = { id, question: kb[i].q, answer: kb[i].a, category: kb[i].cat, keywords: kb[i].kw };
    await prisma.knowledgeBaseEntry.upsert({ where: { id }, create: data, update: data });
  }

  const applianceTypes = [
    ["Refrigerator", "KITCHEN"], ["Dishwasher", "KITCHEN"], ["Water Heater", "PLUMBING"], ["HVAC Unit", "HVAC"],
  ];
  let applianceCount = 0;
  for (let ri = 0; ri < Math.min(6, rentals.length); ri++) {
    for (let ai = 0; ai < applianceTypes.length; ai++) {
      const id = `demo-appl-${rentals[ri].id}-${ai + 1}`;
      const data: Prisma.ApplianceUncheckedCreateInput = { id, rentalId: rentals[ri].id, name: applianceTypes[ai][0], type: applianceTypes[ai][1] };
      await prisma.appliance.upsert({ where: { id }, create: data, update: data });
      applianceCount++;
    }
  }

  const pm = [
    { component: "HVAC Unit", failureProbability: 0.72, predictedFailureDate: daysFromNow(35), recommendedAction: "Schedule coil cleaning and refrigerant check", estimatedCost: 380 },
    { component: "Water Heater", failureProbability: 0.58, predictedFailureDate: daysFromNow(80), recommendedAction: "Flush tank and inspect anode rod", estimatedCost: 220 },
    { component: "Roof", failureProbability: 0.31, predictedFailureDate: daysFromNow(200), recommendedAction: "Inspect flashing before rainy season", estimatedCost: 650 },
    { component: "Dishwasher", failureProbability: 0.44, predictedFailureDate: daysFromNow(120), recommendedAction: "Replace door gasket", estimatedCost: 90 },
  ];
  for (let i = 0; i < pm.length; i++) {
    const id = `demo-pm-${i + 1}`;
    const p = pm[i];
    const data: Prisma.PredictiveMaintenanceUncheckedCreateInput = {
      id,
      rentalId: rentals[(i * 2) % rentals.length].id,
      prediction: { ...p, predictedFailureDate: p.predictedFailureDate.toISOString(), confidence: 0.8 },
    };
    await prisma.predictiveMaintenance.upsert({ where: { id }, create: data, update: data });
  }

  const tip = [
    { idx: 1, issueType: "LATE_PAYMENT", likelihood: 0.67 },
    { idx: 4, issueType: "NOISE_COMPLAINT", likelihood: 0.52 },
    { idx: 2, issueType: "LEASE_NON_RENEWAL", likelihood: 0.18 },
    { idx: 0, issueType: "MAINTENANCE_ESCALATION", likelihood: 0.35 },
  ];
  for (let i = 0; i < tip.length; i++) {
    const id = `demo-tip-${i + 1}`;
    const data: Prisma.TenantIssuePredictionUncheckedCreateInput = {
      id,
      tenantId: demoTenants[tip[i].idx].id,
      issueType: tip[i].issueType,
      likelihood: tip[i].likelihood,
      predictedAt: daysAgo(i + 1),
    };
    await prisma.tenantIssuePrediction.upsert({ where: { id }, create: data, update: data });
  }
  console.log(`  extras: ${kb.length} KB entries, ${applianceCount} appliances, ${pm.length} predictive maintenance, ${tip.length} tenant issue predictions`);

  // ---- Row counts -------------------------------------------------------------
  const counts: Record<string, number> = {
    user: await prisma.user.count(),
    "user (TENANT)": await prisma.user.count({ where: { role: "TENANT" } }),
    rental: await prisma.rental.count(),
    lease: await prisma.lease.count(),
    transaction: await prisma.transaction.count(),
    application: await prisma.application.count(),
    screening: await prisma.screening.count(),
    riskAssessment: await prisma.riskAssessment.count(),
    backgroundCheck: await prisma.backgroundCheck.count(),
    maintenanceRequest: await prisma.maintenanceRequest.count(),
    workOrder: await prisma.workOrder.count(),
    workOrderAssignment: await prisma.workOrderAssignment.count(),
    workOrderQuote: await prisma.workOrderQuote.count(),
    scheduledEvent: await prisma.scheduledEvent.count(),
    vendor: await prisma.vendor.count(),
    vendorPerformanceRating: await prisma.vendorPerformanceRating.count(),
    vendorPayment: await prisma.vendorPayment.count(),
    tenantRating: await prisma.tenantRating.count(),
    notification: await prisma.notification.count(),
    message: await prisma.message.count(),
    document: await prisma.document.count(),
    marketingCampaign: await prisma.marketingCampaign.count(),
    promotion: await prisma.promotion.count(),
    leadSource: await prisma.leadSource.count(),
    knowledgeBaseEntry: await prisma.knowledgeBaseEntry.count(),
    appliance: await prisma.appliance.count(),
    predictiveMaintenance: await prisma.predictiveMaintenance.count(),
    tenantIssuePrediction: await prisma.tenantIssuePrediction.count(),
  };
  console.log("\nRow counts:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(26)} ${v}`);
  console.log("\nDemo data seeded.");
}

main()
  .catch((e) => {
    console.error("Demo seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
