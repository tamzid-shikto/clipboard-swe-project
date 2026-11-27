// End-to-end test for the clipboard app. Starts the server, drives a real browser, logs live.
//
//   npm i -D puppeteer
//   node e2e.js                 (HEADED=1 to watch the browser, SLOW=150 to slow it down)
//
// The server runs from a temp copy of the project, so your real database.json is never touched.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { console.error("puppeteer not found. Run: npm i -D puppeteer"); process.exit(1); }

const PORT = 3000;
const BASE = `http://localhost:${PORT}`;

// ---------- tiny helpers ----------
const color = (n) => (s) => `\x1b[${n}m${s}\x1b[0m`;
const green = color(32), red = color(31), cyan = color(36), dim = color(2), yellow = color(33);

const results = [];
async function step(name, fn) {
    const t = Date.now();
    console.log(cyan(`\n▶ ${name}`));
    try {
        await fn();
        results.push({ name, ok: true });
        console.log(green(`✓ ${name}`) + dim(` (${Date.now() - t}ms)`));
    } catch (e) {
        results.push({ name, ok: false, err: e.message });
        console.log(red(`✗ ${name}\n    ${e.message}`));
    }
}

const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (actual, expected, label) => {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const text = (p, sel) => p.$eval(sel, (e) => e.textContent.trim());
const waitPath = (p, prefix) => p.waitForFunction((x) => location.pathname.startsWith(x), {}, prefix);
const waitText = (p, sel, str) =>
    p.waitForFunction((s, t) => document.querySelector(s)?.textContent.includes(t), {}, sel, str);
const fill = async (p, sel, value) => { await p.$eval(sel, (e) => (e.value = "")); await p.type(sel, value); };
const api = (p, url, method = "GET", body) =>
    p.evaluate(async (url, method, body) => {
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
        return { status: res.status, json: await res.json() };
    }, url, method, body);

// Live browser-side logging: API calls, JS errors, console errors
function watch(page, who) {
    const log = (msg) => console.log(dim(`   [${who}] `) + msg);
    page.on("pageerror", (e) => log(red("page error: " + e.message)));
    page.on("console", (m) => {
        if (["error", "warning"].includes(m.type()) && !m.text().startsWith("Failed to load resource"))
            log(yellow(`console.${m.type()}: ${m.text()}`));
    });
    page.on("response", (r) => {
        const u = new URL(r.url());
        if (u.pathname.startsWith("/api/")) log(`${r.request().method()} ${u.pathname}${u.search} → ${r.status()}`);
    });
}

// ---------- app-specific helpers ----------
async function newPage(browser, who) {
    // each "person" gets their own context = their own cookies
    const ctx = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(5000);
    page.on("dialog", (d) => d.accept()); // confirm("Delete this clipboard?")
    watch(page, who);
    return page;
}

async function authenticate(p, mode, user, pass) {
    await p.goto(BASE + "/auth/");
    await p.click(`.tabs button[data-mode="${mode}"]`);
    await fill(p, "#username", user);
    await fill(p, "#password", pass);
    await p.click("#submit");
}

// Creates a clipboard through the dashboard + editor UI, returns its id
async function createClipboard(p, o) {
    await p.goto(BASE + "/dashboard/");
    await p.click("#new");
    await waitPath(p, "/clipboard-editor");
    await p.waitForSelector("#panel:not(.hidden)");
    const id = new URL(p.url()).searchParams.get("id");
    await fill(p, "#title", o.title);
    await fill(p, "#text", o.text);
    await p.select("#visibility", String(o.visibility));
    if (o.password) await fill(p, "#password", o.password);
    if (o.expires) await p.$eval("#expires", (e, v) => (e.value = v), o.expires);
    await p.click("#save");
    await waitText(p, "#status", "Saved");
    return id;
}

const dashboardTitles = (p) => p.$$eval(".item .title", (els) => els.map((e) => e.textContent));

// ---------- the tests ----------
async function runTests(browser) {
    const alice = await newPage(browser, "alice");
    const bob = await newPage(browser, "bob");
    const anon = await newPage(browser, "anon ");
    let pubId, privId, pwId, oldId, xssId;

    await step("Landing page loads and 'Get started' leads to /auth/", async () => {
        await anon.goto(BASE + "/");
        eq(await text(anon, "h1"), "Clipboard", "heading");
        await anon.click("a.btn");
        await waitPath(anon, "/auth/");
    });

    await step("Logged-out visitors are blocked", async () => {
        await anon.goto(BASE + "/");
        for (const url of ["/api/list-clipboard", "/api/edit-clipboard?id=x"]) {
            eq((await api(anon, url)).status, 401, url);
        }
        for (const url of ["/api/create-clipboard", "/api/save-clipboard?id=x", "/api/delete-clipboard?id=x"]) {
            eq((await api(anon, url, "POST", {})).status, 401, url);
        }
        await anon.goto(BASE + "/dashboard/");
        await waitPath(anon, "/auth/");
    });

    await step("Sign up as alice -> dashboard with empty state", async () => {
        await authenticate(alice, "signup", "alice", "pass123");
        await waitPath(alice, "/dashboard");
        await waitText(alice, "#username", "alice");
        await alice.waitForSelector("#empty.show");
    });

    await step("Signing up with a taken username shows an error", async () => {
        await authenticate(anon, "signup", "alice", "other");
        await waitText(anon, "#errorText", "already taken");
    });

    await step("Login with wrong password shows an error", async () => {
        await authenticate(anon, "login", "alice", "WRONG");
        await waitText(anon, "#errorText", "Invalid username or password");
        ok(new URL(anon.url()).pathname.startsWith("/auth"), "should stay on /auth/");
    });

    await step("Logout kills the session, login works again", async () => {
        await alice.click("#logout");
        await waitPath(alice, "/auth/");
        eq((await api(alice, "/api/list-clipboard")).status, 401, "API after logout");
        await authenticate(alice, "login", "alice", "pass123");
        await waitPath(alice, "/dashboard");
        await waitText(alice, "#username", "alice");
    });

    await step("Create a public clipboard in the editor", async () => {
        pubId = await createClipboard(alice, { title: "Hello", text: "world text", visibility: 1 });
        ok(/^[0-9a-f]{8}$/.test(pubId), "id should be 8 hex chars, got " + pubId);
    });

    await step("Saved clipboard reloads with the same values and shows on dashboard", async () => {
        await alice.goto(`${BASE}/clipboard-editor/?id=${pubId}`);
        await alice.waitForSelector("#panel:not(.hidden)");
        eq(await alice.$eval("#title", (e) => e.value), "Hello", "title");
        eq(await alice.$eval("#text", (e) => e.value), "world text", "text");
        eq(await alice.$eval("#visibility", (e) => e.value), "1", "visibility");
        await alice.goto(BASE + "/dashboard/");
        await alice.waitForSelector(".item");
        ok((await dashboardTitles(alice)).includes("Hello"), "dashboard should list 'Hello'");
    });

    await step("Owner viewing own clipboard: sees Edit link, view NOT counted", async () => {
        await alice.goto(`${BASE}/clipboard/?id=${pubId}`);
        await alice.waitForSelector("#view:not(.hidden)");
        eq(await text(alice, "#text"), "world text", "text");
        eq(await text(alice, "#views"), "0 views", "views");
        await alice.waitForSelector("#editLink:not(.hidden)");
    });

    await step("Anonymous visitor can read a public clipboard, view IS counted", async () => {
        await anon.goto(`${BASE}/clipboard/?id=${pubId}`);
        await anon.waitForSelector("#view:not(.hidden)");
        eq(await text(anon, "#title"), "Hello", "title");
        eq(await text(anon, "#text"), "world text", "text");
        eq(await text(anon, "#views"), "1 view", "views");
        ok(await anon.$("#editLink.hidden"), "edit link must be hidden for non-owner");
    });

    await step("Private clipboard is hidden from others, visible to owner", async () => {
        privId = await createClipboard(alice, { title: "Secret", text: "top secret", visibility: 0 });
        await anon.goto(`${BASE}/clipboard/?id=${privId}`);
        await waitText(anon, "#message", "not found");
        await alice.goto(`${BASE}/clipboard/?id=${privId}`);
        await alice.waitForSelector("#view:not(.hidden)");
    });

    await step("Password clipboard: lock screen, wrong password rejected, right one unlocks", async () => {
        pwId = await createClipboard(alice, { title: "Locked", text: "behind a password", visibility: 2, password: "pw123" });
        await anon.goto(`${BASE}/clipboard/?id=${pwId}`);
        await anon.waitForSelector("#lock:not(.hidden)");
        ok(!(await anon.$eval("body", (b) => b.textContent.includes("behind a password"))), "text leaked before unlock");
        await fill(anon, "#password", "nope");
        await anon.click("#unlock");
        await anon.waitForSelector("#lockError.show");
        await waitText(anon, "#lockError", "Wrong password");
        await fill(anon, "#password", "pw123");
        await anon.click("#unlock");
        await anon.waitForSelector("#view:not(.hidden)");
        eq(await text(anon, "#text"), "behind a password", "text");
    });

    await step("Expired clipboard is hidden from others, visible to owner", async () => {
        oldId = await createClipboard(alice, { title: "Old", text: "expired text", visibility: 1, expires: "2000-01-01T00:00" });
        await anon.goto(`${BASE}/clipboard/?id=${oldId}`);
        await waitText(anon, "#message", "not found");
        await alice.goto(`${BASE}/clipboard/?id=${oldId}`);
        await alice.waitForSelector("#view:not(.hidden)");
    });

    await step("HTML in a title is escaped (no XSS)", async () => {
        const evil = `<img src=x onerror="window.__xss=1">`;
        xssId = await createClipboard(alice, { title: evil, text: "<script>window.__xss=1</script>", visibility: 1 });
        await alice.goto(BASE + "/dashboard/");
        await alice.waitForSelector(".item");
        ok((await dashboardTitles(alice)).includes(evil), "title should show as literal text");
        eq(await alice.$(".item .title img"), null, "no <img> element inside title");
        await anon.goto(`${BASE}/clipboard/?id=${xssId}`);
        await anon.waitForSelector("#view:not(.hidden)");
        eq(await text(anon, "#title"), evil, "view page title");
        eq(await anon.evaluate(() => window.__xss), undefined, "script must not run");
    });

    await step("Another user (bob) cannot edit, save or delete alice's clipboard", async () => {
        await authenticate(bob, "signup", "bob", "bobpass");
        await waitPath(bob, "/dashboard");
        await bob.goto(`${BASE}/clipboard-editor/?id=${pubId}`);
        await waitText(bob, "#empty", "Not found");
        eq((await api(bob, `/api/edit-clipboard?id=${pubId}`)).json.success, false, "edit-clipboard");
        eq((await api(bob, `/api/save-clipboard?id=${pubId}`, "POST", { title: "hacked" })).json.success, false, "save-clipboard");
        eq((await api(bob, `/api/delete-clipboard?id=${pubId}`, "POST")).json.success, false, "delete-clipboard");
        eq((await api(bob, "/api/list-clipboard")).json.data.length, 0, "bob's own list");
        // bob can still *read* the public one, but not the private one
        await bob.goto(`${BASE}/clipboard/?id=${pubId}`);
        eq(await text(bob, "#title"), "Hello", "public title for bob");
        await bob.goto(`${BASE}/clipboard/?id=${privId}`);
        await waitText(bob, "#message", "not found");
    });

    await step("Delete from the dashboard removes it for everyone", async () => {
        await alice.goto(BASE + "/dashboard/");
        await alice.waitForSelector(`button[data-act="delete"][data-id="${xssId}"]`);
        await alice.click(`button[data-act="delete"][data-id="${xssId}"]`);
        await alice.waitForFunction((id) => !document.querySelector(`button[data-act="delete"][data-id="${id}"]`), {}, xssId);
        await anon.goto(`${BASE}/clipboard/?id=${xssId}`);
        await waitText(anon, "#message", "not found");
    });
}

// ---------- main ----------
(async () => {
    // run the server from a temp copy so database.json stays clean
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clipboard-e2e-"));
    fs.cpSync(__dirname, tmp, {
        recursive: true,
        filter: (src) => !["node_modules", "database.json", ".git"].includes(path.basename(src)),
    });
    const modulesLink = path.join(tmp, "node_modules");
    fs.symlinkSync(path.join(__dirname, "node_modules"), modulesLink, "junction");

    console.log(dim(`temp copy: ${tmp}`));
    const server = spawn(process.execPath, ["server.js"], { cwd: tmp });
    let browser;
    try {
        await new Promise((resolve, reject) => {
            server.stdout.on("data", (d) => { process.stdout.write(dim("[server] " + d)); if (String(d).includes("STARTED")) resolve(); });
            server.stderr.on("data", (d) => process.stderr.write(red("[server] " + d)));
            server.on("exit", (code) => reject(new Error(`server exited (code ${code}). Is port ${PORT} already in use?`)));
        });

        browser = await puppeteer.launch({
            headless: !process.env.HEADED,
            slowMo: Number(process.env.SLOW) || 0,
            args: ["--no-sandbox"],
        });
        await runTests(browser);
    } catch (e) {
        console.log(red("\nFatal: " + e.message));
        results.push({ name: "setup", ok: false, err: e.message });
    } finally {
        if (browser) await browser.close();
        // Windows locks the folder while the server is still running, so wait for it to exit first
        if (server.exitCode === null) {
            const exited = new Promise((r) => server.once("exit", r));
            server.kill();
            await exited;
        }
        try { fs.unlinkSync(modulesLink); } catch {}
        try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
        catch (e) { console.log(yellow(`(could not delete temp folder ${tmp}: ${e.code})`)); }
    }

    const failed = results.filter((r) => !r.ok);
    console.log("\n" + "─".repeat(50));
    console.log(`${green(results.length - failed.length + " passed")}, ${failed.length ? red(failed.length + " failed") : "0 failed"}`);
    failed.forEach((r) => console.log(red(`  ✗ ${r.name}: ${r.err}`)));
    process.exit(failed.length ? 1 : 0);
})();