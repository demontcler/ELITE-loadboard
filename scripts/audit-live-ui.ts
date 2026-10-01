/**
 * Live HTTP + browser verification for auth and job creation UI.
 */
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome-stable";

type Cred = { email: string; password: string; role: string };

const USERS: Cred[] = [
  { email: "admin@elite-loadboard.local", password: "admin123!", role: "ADMIN" },
  { email: "dispatch@elite-loadboard.local", password: "dispatch123!", role: "DISPATCHER" },
  { email: "accounting@elite-loadboard.local", password: "accounting123!", role: "ACCOUNTING" },
  { email: "ops@elite-loadboard.local", password: "ops123!", role: "OPERATIONS_MANAGER" },
  { email: "viewer@elite-loadboard.local", password: "viewer123!", role: "VIEW_ONLY" },
];

async function loginViaHttp(cred: Cred): Promise<{ ok: boolean; detail: string }> {
  const jar = new Map<string, string>();

  function storeCookies(res: Response) {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
  function cookieHeader() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { cookie: cookieHeader() },
  });
  storeCookies(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    csrfToken,
    email: cred.email,
    password: cred.password,
    callbackUrl: `${BASE}/`,
    json: "true",
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
    },
    body,
    redirect: "manual",
  });
  storeCookies(loginRes);

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: cookieHeader() },
  });
  const session = (await sessionRes.json()) as {
    user?: { email?: string; role?: string };
  };

  if (session?.user?.email === cred.email && session.user.role === cred.role) {
    return { ok: true, detail: `session role=${session.user.role}` };
  }
  return {
    ok: false,
    detail: `expected ${cred.role}, got ${JSON.stringify(session)} status=${loginRes.status}`,
  };
}

async function browserJobCreation() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Login as admin
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
    await page.click("#email", { clickCount: 3 });
    await page.type("#email", "admin@elite-loadboard.local");
    await page.click("#password", { clickCount: 3 });
    await page.type("#password", "admin123!");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click('button[type="submit"]'),
    ]);

    const urlAfterLogin = page.url();
    assert.ok(!urlAfterLogin.includes("/login"), `still on login: ${urlAfterLogin}`);
    const cookies = await page.cookies();
    console.log(
      "COOKIES",
      cookies.map((c) => ({ name: c.name, path: c.path, httpOnly: c.httpOnly, sameSite: c.sameSite }))
    );

    // Dashboard / shell visible
    const shell = await page.$("aside");
    assert.ok(shell, "App sidebar missing");

    // Navigate to new job
    await page.goto(`${BASE}/jobs/new`, { waitUntil: "networkidle0" });
    const title = await page.$eval("h1", (el) => el.textContent || "");
    assert.ok(title.includes("Create Job"), `unexpected title ${title}`);

    // Form should be open (defaultOpen)
    const customerSelect = await page.$("#customerId");
    assert.ok(customerSelect, "customer select missing — create form not open?");

    // Prefer keyboard input so React controlled state updates
    await page.focus("#trucksRequired");
    await page.click("#trucksRequired", { clickCount: 3 });
    await page.keyboard.type("6");

    await page.evaluate(`(() => {
      const setNative = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return;
        const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        setter?.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      setNative("pickupDate", new Date().toISOString().slice(0, 10));
      setNative("pickupName", "UI Audit Pipe Yard");
      setNative("pickupCity", "Midland");
      setNative("pickupState", "TX");
      setNative("deliveryName", "UI Rig 77");
      setNative("deliveryCounty", "Reeves");
      setNative("deliveryState", "TX");
      setNative("rigName", "UI Rig 77");
      setNative("leaseName", "UI Lease");
      setNative("wellName", "UI 2H");
      setNative("customerRate", "30000");
      setNative("specialInstructions", "Created via Phase 1-4 audit browser test");
    })()`);

    // Confirm payload fields before submit
    const pre = await page.evaluate(`({
      customerId: document.getElementById("customerId")?.value,
      trucksRequired: document.getElementById("trucksRequired")?.value,
      pickupName: document.getElementById("pickupName")?.value
    })`);
    console.log("PRE-SUBMIT", pre);

    page.on("response", (res) => {
      const u = res.url();
      if (u.includes("jobs") || u.includes("action") || res.status() >= 300) {
        console.log("RESP", res.status(), u.slice(0, 120));
      }
    });

    // Click the Create Job submit (NOT the header Sign out submit)
    await page.evaluate(`(() => {
      const buttons = [...document.querySelectorAll('button[type="submit"]')];
      const createBtn = buttons.find((b) => (b.textContent || "").includes("Create Job"));
      if (!createBtn) throw new Error("Create Job submit button not found");
      createBtn.click();
    })()`);
    const outcome = await Promise.race([
      page
        .waitForFunction(() => /^\/jobs\/(?!new$)[^/]+$/.test(window.location.pathname), {
          timeout: 30000,
        })
        .then(() => "navigated" as const),
      page
        .waitForFunction(
          () => !!document.querySelector("p.text-red-600")?.textContent?.trim(),
          { timeout: 30000 }
        )
        .then(async () => {
          const msg = await page.$eval("p.text-red-600", (el) => el.textContent || "");
          return `error:${msg}` as const;
        }),
    ]).catch(async () => {
      const snap = await page.evaluate(`({
        url: location.href,
        trucks: document.getElementById("trucksRequired")?.value,
        err: document.querySelector("p.text-red-600")?.textContent || null,
        text: document.body.innerText.slice(0, 1500)
      })`);
      console.log("TIMEOUT SNAP", snap);
      return "timeout" as const;
    });

    console.log("FORM OUTCOME", outcome);
    if (typeof outcome === "string" && !outcome.startsWith("navigated") && outcome !== "navigated") {
      throw new Error(`Job create failed: ${outcome}`);
    }
    if (outcome !== "navigated") {
      throw new Error(`Job create did not navigate. outcome=${outcome}`);
    }

    const jobUrl = page.url();
    assert.match(jobUrl, /\/jobs\/(?!new$)[^/]+$/, `expected job detail URL, got ${jobUrl}`);
    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => undefined);

    const bodyText = await page.evaluate(() => document.body?.innerText || "");
    const fs = await import("node:fs/promises");
    await fs.writeFile("/tmp/audit-job-detail.txt", `URL: ${jobUrl}\n\n${bodyText}`);
    await page.screenshot({ path: "/tmp/audit-job-detail.png", fullPage: true }).catch(() => undefined);

    assert.ok(bodyText.includes("TRK-001"), `TRK-001 missing. Snippet: ${bodyText.slice(0, 800)}`);
    assert.ok(bodyText.includes("TRK-006"), "TRK-006 missing — 6 trucks not generated?");
    assert.ok(
      bodyText.includes("UI Rig 77") || bodyText.includes("UI Audit Pipe Yard"),
      "route context missing"
    );

    // Add cargo to truck 1 via UI
    // Click first "Add Cargo" button
    const addCargoButtons = await page.$$("button");
    let clicked = false;
    for (const btn of addCargoButtons) {
      const text = await page.evaluate((el) => el.textContent || "", btn);
      if (text.trim() === "Add Cargo") {
        await btn.click();
        clicked = true;
        break;
      }
    }
    assert.ok(clicked, "Add Cargo button not found");

    await page.waitForSelector("#materialDescription", { timeout: 5000 });
    await page.select("#materialCategory", "CASING");
    await page.type("#materialDescription", 'UI 5.5" casing');
    await page.type("#totalFootage", "1200");
    await page.type("#weightPerFoot", "36");

    // Submit the cargo form (last Create button in open form — "Add Cargo")
    await page.evaluate(() => {
      const forms = [...document.querySelectorAll("form")];
      const cargoForm = forms.find((f) => f.querySelector("#materialDescription"));
      if (!cargoForm) throw new Error("cargo form not found");
      const btn = cargoForm.querySelector('button[type="submit"]') as HTMLButtonElement;
      btn.click();
    });
    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => undefined);
    await page.waitForFunction(
      () => document.body.innerText.includes('UI 5.5" casing') || document.body.innerText.includes("43,200"),
      { timeout: 15000 }
    );

    const afterCargo = await page.evaluate(() => document.body.innerText);
    assert.ok(afterCargo.includes('UI 5.5" casing'), "cargo description not visible after add");
    assert.ok(
      afterCargo.includes("43,200") || afterCargo.includes("43200"),
      "calculated weight 43200 not shown"
    );

    // Load board
    await page.goto(`${BASE}/load-board`, { waitUntil: "networkidle0" });
    const boardText = await page.evaluate(() => document.body.innerText);
    assert.ok(boardText.includes("Future Loads"), "Future column missing");
    assert.ok(boardText.includes("Today's Loads") || boardText.includes("Today"), "Today column missing");
    assert.ok(boardText.includes("Dispatched Loads"), "Dispatched column missing");

    // Responsive: mobile viewport still shows nav or content
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/load-board`, { waitUntil: "networkidle0" });
    const mobileText = await page.evaluate(() => document.body.innerText);
    assert.ok(mobileText.includes("Load Board") || mobileText.includes("Future"), "mobile load board blank");

    await page.setViewport({ width: 768, height: 1024 });
    await page.goto(`${BASE}/customers`, { waitUntil: "networkidle0" });
    const tabletText = await page.evaluate(() => document.body.innerText);
    assert.ok(tabletText.includes("Customers"), "tablet customers page failed");

    // VIEW_ONLY login: can read, pages load
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
    if (page.url().includes("/login")) {
      await page.click("#email", { clickCount: 3 });
      await page.type("#email", "viewer@elite-loadboard.local");
      await page.click("#password", { clickCount: 3 });
      await page.type("#password", "viewer123!");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0" }),
        page.click('button[type="submit"]'),
      ]);
    }

    await page.goto(`${BASE}/customers`, { waitUntil: "networkidle0" });
    const viewerCustomers = await page.evaluate(() => document.body.innerText);
    assert.ok(viewerCustomers.includes("Customers"), "VIEW_ONLY cannot open customers");

    return {
      jobUrl,
      notes: [
        "Admin UI created 6-truck job",
        "Cargo add + weight display worked",
        "Load board columns render",
        "Mobile/tablet viewports render content",
        "VIEW_ONLY can open customers (read path)",
      ],
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log("\n== HTTP auth for all roles ==");
  for (const user of USERS) {
    const result = await loginViaHttp(user);
    console.log(result.ok ? `  ✓ ${user.role}` : `  ✗ ${user.role}`, result.detail);
    if (!result.ok) throw new Error(`Auth failed for ${user.role}`);
  }

  console.log("\n== Browser UI job creation ==");
  const ui = await browserJobCreation();
  for (const n of ui.notes) console.log(`  ✓ ${n}`);
  console.log(`  ✓ Job detail: ${ui.jobUrl}`);
  console.log("\nLive UI audit passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
