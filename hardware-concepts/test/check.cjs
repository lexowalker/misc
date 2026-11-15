// Automated page checks: node test/check.cjs  (needs Playwright + Chromium)
// 1. no console errors, no horizontal page scroll at desktop and phone widths
// 2. callout labels do not overlap each other in any iso pose
// 3. part IDs agree across drawings, parts key and BOM
// 4. keyboard and touch selection work
// 5. every mechanism runs through its full travel and its readout changes
// 6. BOM and run totals reconcile with their rows
const { chromium, devices } = require("playwright");
const path = require("path");
const URL = "file://" + path.join(__dirname, "..", "index.html");
let fails = 0;
const ok = (c, msg) => { console.log((c ? "  ok   " : "  FAIL ") + msg); if (!c) fails++; };

async function overlaps(page, sel) {
  return page.evaluate((sel) => {
    const boxes = [...document.querySelectorAll(sel + " .co-pill")].filter((r) => {
      const g = r.closest(".part-co"); if (!g) return false;
      const o = parseFloat(getComputedStyle(g).opacity); const v = r.closest(".view");
      return o > 0.5 && v && !v.hidden && r.getBoundingClientRect().width > 0;
    }).map((r) => ({ id: r.closest(".callout").dataset.pid, b: r.getBoundingClientRect() }));
    const out = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].b, b = boxes[j].b;
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 2 && iy > 2) out.push(boxes[i].id + "/" + boxes[j].id);
    }
    return out;
  }, sel);
}

(async () => {
  const browser = await chromium.launch();
  for (const [name, ctxOpts] of [["desktop 1440", { viewport: { width: 1440, height: 900 } }], ["phone (iPhone 13)", devices["iPhone 13"]]]) {
    console.log(`\n== ${name}`);
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await page.goto(URL);
    await page.waitForTimeout(500);
    const hs = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(hs <= 0, `no horizontal page scroll (${hs}px)`);

    for (const tab of ["toolkit", "mover"]) {
      await page.click(`#tab-${tab}`);
      for (const v of ["asm", "exp"]) {
        await page.click(`#panel-${tab} .views [data-view=${v}]`);
        await page.waitForTimeout(1300);
        const o = await overlaps(page, `#panel-${tab}`);
        ok(o.length === 0, `${tab} ${v}: callouts clear of each other${o.length ? " — " + o.join(", ") : ""}`);
      }
      if (tab === "mover") {
        await page.click(`#panel-mover .views [data-view=asm]`);
        await page.waitForTimeout(1200);
        await page.evaluate(() => { const i = document.querySelector("[data-i=lift]"); i.value = 10; i.dispatchEvent(new Event("input")); });
        const o = await overlaps(page, `#panel-mover`);
        ok(o.length === 0, `mover lifted: callouts clear${o.length ? " — " + o.join(", ") : ""}`);
        await page.evaluate(() => { const i = document.querySelector("[data-i=lift]"); i.value = 0; i.dispatchEvent(new Event("input")); });
      }
    }

    // IDs: drawings vs key vs BOM
    const ids = await page.evaluate(() => {
      const key = [...document.querySelectorAll(".key-item")].map((b) => b.dataset.pid);
      const drawn = [...new Set([...document.querySelectorAll(".view [data-pid]")].map((n) => n.dataset.pid))];
      const bom = [...document.querySelectorAll(".tbl tbody tr td.mono")].map((td) => td.textContent.trim()).filter((t) => /^[A-Z]\d/.test(t) && !/^S\d$/.test(t));
      return { key, drawn, bom, parts: Object.keys(DATA.parts) };
    });
    const expand = (t) => t.split(/,\s*/).flatMap((p) => { const m = p.match(/^([A-Z])(\d+)–[A-Z]?(\d+)$/); return m ? Array.from({ length: +m[3] - +m[2] + 1 }, (_, i) => m[1] + (+m[2] + i)) : [p]; });
    const bomIds = [...new Set(ids.bom.flatMap(expand))];
    ok(ids.drawn.every((d) => ids.key.includes(d)), `every drawn ID is in the parts key (${ids.drawn.length} drawn)`);
    const undrawn = ids.key.filter((k) => !ids.drawn.includes(k));
    ok(undrawn.length === 0, `every key ID appears in a drawing${undrawn.length ? " — missing: " + undrawn.join(", ") : ""}`);
    const badBom = bomIds.filter((b) => !ids.key.includes(b));
    ok(badBom.length === 0, `every BOM part ID is in the key${badBom.length ? " — " + badBom.join(", ") : ""}`);

    // selection: keyboard on a callout, touch/click on key
    await page.click("#tab-toolkit");
    await page.click("#panel-toolkit .views [data-view=asm]");
    await page.waitForTimeout(1200);
    await page.focus('#panel-toolkit .part-co[data-pid="B1"] .callout');
    await page.keyboard.press("Enter");
    let d = await page.textContent("#panel-toolkit [data-desc]");
    ok(/B1/.test(d) && /battery/i.test(d), "Enter on callout B1 selects it and shows its description");
    const keyPressed = await page.getAttribute('#panel-toolkit .key-item[data-pid="B1"]', "aria-pressed");
    ok(keyPressed === "true", "matching key entry highlights");
    await page.click('#panel-toolkit .key-item[data-pid="D7"]');
    await page.waitForTimeout(1200);
    const view = await page.getAttribute("#panel-toolkit .views [aria-selected=true]", "data-view");
    ok(view === "exp", "selecting internal part D7 from the key switches to the exploded view");
    d = await page.textContent("#panel-toolkit [data-desc]");
    ok(/Crown gear/.test(d), "D7 description shown");
    await page.focus('#panel-toolkit .key-item[data-pid="D7"]');
    await page.keyboard.press("ArrowDown");
    const foc = await page.evaluate(() => document.activeElement.dataset.pid);
    ok(foc === "D8", "ArrowDown moves focus through the parts key");
    if (name.startsWith("phone")) {
      await page.click('#panel-toolkit .views [data-view=asm]');
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.querySelector('#panel-toolkit .part-co[data-pid="D2"] .co-pill').scrollIntoView({ block: "center" }));
      await page.tap('#panel-toolkit .part-co[data-pid="D2"] .co-pill');
      d = await page.textContent("#panel-toolkit [data-desc]");
      ok(/Clocking collar/.test(d), "tap on callout D2 selects it");
      const order = await page.evaluate(() => { const s = document.querySelector("#panel-toolkit .stage").getBoundingClientRect(), dd = document.querySelector("#panel-toolkit [data-desc]").getBoundingClientRect(); return dd.top - s.bottom; });
      ok(Math.abs(order) < 4, `phone: description sits directly under the drawing (gap ${Math.round(order)}px)`);
    }

    // mechanisms: full travel, readout changes, no errors
    const sweep = async (tab, view, input, seg) => {
      await page.click(`#tab-${tab}`);
      await page.click(`#panel-${tab} .views [data-view=${view}]`);
      const opts = seg ? await page.$$eval(`#panel-${tab} button[data-${seg}]`, (bs, seg) => bs.map((b) => b.dataset[seg]), seg) : [null];
      for (const o of opts) {
        if (o) await page.click(`#panel-${tab} button[data-${seg}="${o}"]`);
        const reads = await page.evaluate(([tab, input]) => {
          const i = document.querySelector(`#panel-${tab} [data-i=${input}]`), r = document.querySelector(`#panel-${tab} [data-readout]`);
          const out = new Set(); const min = +i.min, max = +i.max;
          for (let k = 0; k <= 40; k++) { i.value = min + ((max - min) * k) / 40; i.dispatchEvent(new Event("input")); out.add(r.textContent); }
          return out.size;
        }, [tab, input]);
        ok(reads > 3, `${tab} ${view}${o ? " / " + o : ""}: full travel gives ${reads} distinct readouts`);
      }
    };
    await sweep("toolkit", "use", "approach", "tool");
    await sweep("toolkit", "ham", "drive", "htool");
    await sweep("mover", "seq", "step");
    await sweep("mover", "plan", "route");
    await sweep("mover", "asm", "lift");

    // costs reconcile
    const rec = await page.evaluate(() => {
      const res = [];
      document.querySelectorAll(".panel").forEach((p) => {
        const t = p.querySelector(".sec .tbl"); // first table in Costs is the BOM
        const rows = [...p.querySelectorAll(".sec:nth-of-type(3) .tbl")[0].querySelectorAll("tbody tr")];
        const num = (s) => parseFloat(s.replace(/[$,]/g, ""));
        let stageSum = 0, all = 0, stageOk = true;
        rows.forEach((r) => {
          const c = r.querySelectorAll("td");
          if (r.classList.contains("sub")) { stageOk = stageOk && Math.abs(num(c[4].textContent) - stageSum) < 0.02; all += stageSum; stageSum = 0; }
          else if (r.classList.contains("tot")) res.push({ tab: p.dataset.tab, stageOk, totalOk: Math.abs(num(c[4].textContent) - all) < 0.02, total: c[4].textContent });
          else if (c.length === 6) stageSum += num(c[4].textContent);
        });
      });
      return res;
    });
    rec.forEach((r) => ok(r.stageOk && r.totalOk, `${r.tab}: BOM stage subtotals and founder total (${r.total}) reconcile with rows`));
    const runs = await page.evaluate(() => {
      const k = (s) => { const m = s.replace(/[$,]/g, ""); return m.endsWith("k") ? parseFloat(m) * 1000 : parseFloat(m); };
      return [...document.querySelectorAll(".tbl.runs")].map((t) => {
        const rows = [...t.querySelectorAll("tbody tr")].filter((r) => r.querySelectorAll("td").length);
        const get = (label) => rows.find((r) => r.cells[0].textContent.startsWith(label));
        const cols = rows[0].cells.length - 1; const out = [];
        for (let c = 1; c <= cols; c++) {
          const one = get("One-time total").cells[c].textContent.split("–").map(k);
          const q = get("× quantity").cells[c].textContent.split("–").map(k);
          const tot = get("Total cash required").cells[c].textContent.split("–").map(k);
          out.push(Math.abs(one[0] + q[0] - tot[0]) / tot[0] < 0.02 && Math.abs(one[1] + q[1] - tot[1]) / tot[1] < 0.02);
        }
        return out;
      });
    });
    ok(runs.flat().every(Boolean), `pilot and 1,000-unit totals = one-time + quantity × landed (within display rounding)`);
    ok(errs.length === 0, `no console errors${errs.length ? " — " + errs.join(" | ") : ""}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
  process.exit(fails ? 1 : 0);
})();
