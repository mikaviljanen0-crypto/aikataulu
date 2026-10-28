import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const port = 31339;
const server = spawn(
  process.execPath,
  ["scripts/serve-static.mjs"],
  {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let serverOutput = "";
server.stdout.on("data", (part) => { serverOutput += part.toString(); });
server.stderr.on("data", (part) => { serverOutput += part.toString(); });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ timezoneId: "Europe/Helsinki" });
const page = await context.newPage();
const messages = [];
page.on("pageerror", (e) => messages.push("PAGE ERROR: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") messages.push("CONSOLE ERROR: " + m.text());
});
page.on("requestfailed", (r) => messages.push("REQUEST FAILED: " + r.url() + " - " + r.failure()?.errorText));

try {
  for(let n=0;n<25;n++){
    try {
      const res = await fetch("http://127.0.0.1:"+port+"/", {signal:AbortSignal.timeout(1500)});
      if(res.ok) break;
    } catch {}
    await sleep(400);
  }
  await page.goto("http://127.0.0.1:" + port + "/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  console.log("Browser timezone:", await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone));
  console.log("Page title:", await page.title());
  console.log("Document readyState:", await page.evaluate(() => document.readyState));
  await page.getByRole("button", {name:"Projektit", exact:true}).first().click({timeout:20000});
  await page.getByRole("dialog",{name:"Projektit"}).waitFor({timeout:12000});
  console.log("PASS: React hydration and Projektit button work.");
  await page.getByRole("button",{name:"Luo",exact:true}).first().isVisible();
  console.log("PASS: Project dialog rendered.");
  // Havaitaan viiveellä alkava pääsäikeen jumi: käyttäjän sivu piirtyi,
  // mutta myöhemmin Edge ja Chrome näyttivät "Sivu ei vastaa".
  await sleep(12000);
  const heartbeat = await page.evaluate(() => new Promise((resolve) => {
    const started = performance.now();
    window.setTimeout(() => resolve(Math.round(performance.now() - started)), 75);
  }));
  if (heartbeat > 2000) throw new Error("Browser main-thread heartbeat delayed: " + heartbeat + " ms");
  await page.getByRole("button", {name:"Sulje", exact:true}).first().click({timeout:12000}).catch(async () => {
    await page.keyboard.press("Escape");
  });
  await page.getByRole("button", {name:"Projektit", exact:true}).first().click({timeout:12000});
  await page.getByRole("dialog",{name:"Projektit"}).waitFor({timeout:12000});
  console.log("PASS: Windows browser stays interactive after repeated actions; event loop latency:", heartbeat);
  // Suuri aikataulu: yläosan ja sarakeotsikoiden pitää pysyä lukittuina.
  await page.getByRole("dialog", { name: "Projektit" })
    .getByRole("button", { name: "Sulje" }).click();
  await page.setViewportSize({ width: 1440, height: 700 });
  for (let index = 0; index < 25; index += 1) {
    await page.getByRole("button", { name: "+ Työvaihe" }).click();
  }
  const beforeHeaderY = await page.locator(".topbar").evaluate((el) => Math.round(el.getBoundingClientRect().top));
  await page.locator(".task-pane").evaluate((el) => {
    el.scrollTop = 310;
    el.dispatchEvent(new Event("scroll"));
  });
  await sleep(250);
  const firstScroll = await page.evaluate(() => ({
    table: document.querySelector(".task-pane")?.scrollTop ?? -1,
    gantt: document.querySelector(".gantt-pane")?.scrollTop ?? -1,
    topbar: Math.round(document.querySelector(".topbar")?.getBoundingClientRect().top ?? -1),
    tableHeader: Math.round(document.querySelector(".schedule-table thead th")?.getBoundingClientRect().top ?? -1),
    paneTop: Math.round(document.querySelector(".task-pane")?.getBoundingClientRect().top ?? -1),
  }));
  if (firstScroll.table < 100 || Math.abs(firstScroll.table - firstScroll.gantt) > 2) {
    throw new Error("Table-to-Gantt vertical scroll is not synchronized: " + JSON.stringify(firstScroll));
  }
  if (firstScroll.topbar !== beforeHeaderY || Math.abs(firstScroll.tableHeader - firstScroll.paneTop) > 2) {
    throw new Error("Workspace header is not locked: " + JSON.stringify(firstScroll));
  }
  await page.locator(".gantt-pane").evaluate((el) => {
    el.scrollTop = 130;
    el.dispatchEvent(new Event("scroll"));
  });
  await sleep(250);
  const secondScroll = await page.evaluate(() => ({
    table: document.querySelector(".task-pane")?.scrollTop ?? -1,
    gantt: document.querySelector(".gantt-pane")?.scrollTop ?? -1,
  }));
  if (Math.abs(secondScroll.table - secondScroll.gantt) > 2 ||
      Math.abs(secondScroll.table - 130) > 2) {
    throw new Error("Gantt-to-table vertical scroll is not synchronized: " + JSON.stringify(secondScroll));
  }
  console.log("PASS: Locked toolbar, sticky table header and bidirectional synchronized scrolling.");

  // Apurivi tulee oikeaan näkyvän rivin indeksiin taulukossa, Ganttissa ja A3:ssa.
  const guideRows = await page.evaluate(() => {
    const table = Array.from(document.querySelectorAll(".schedule-table tbody tr"));
    const gantt = Array.from(document.querySelectorAll(".gantt-row"));
    const printed = Array.from(document.querySelectorAll(".report-sheet"));
    return {
      tableCount: table.length,
      ganttCount: gantt.length,
      tableGuides: table.flatMap((el, i) => el.classList.contains("guide-row") ? [i + 1] : []),
      ganttGuides: gantt.flatMap((el, i) => el.classList.contains("guide-row") ? [i + 1] : []),
      printMatch: printed.every(sheet => {
        const left = Array.from(sheet.querySelectorAll(".report-table-row"));
        const right = Array.from(sheet.querySelectorAll(".report-chart-row"));
        return left.length === right.length && left.every((row, i) =>
          row.classList.contains("guide-row") === ((i + 1) % 5 === 0) &&
          right[i].classList.contains("guide-row") === ((i + 1) % 5 === 0));
      }),
    };
  });
  const expectedGuides = Array.from({length:guideRows.tableCount}, (_, i) => i+1).filter(x=>x%5===0);
  if (guideRows.tableCount !== guideRows.ganttCount ||
      JSON.stringify(guideRows.tableGuides) !== JSON.stringify(expectedGuides) ||
      JSON.stringify(guideRows.ganttGuides) !== JSON.stringify(expectedGuides) ||
      !guideRows.printMatch) {
    throw new Error("Every-fifth-row guidelines are misaligned: " + JSON.stringify(guideRows));
  }
  console.log("PASS: Fifth-row guide alignment in table, Gantt and printed report.");

  // Testataan oikeat pikselikoordinaatit, ei ainoastaan oikean luokan olemassaoloa.
  await page.locator(".task-pane").evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event("scroll")); });
  await sleep(150);
  const screenGeometry = await page.evaluate(() => {
    const left = Array.from(document.querySelectorAll(".schedule-table tbody tr"));
    const right = Array.from(document.querySelectorAll(".gantt-row"));
    const last = Math.min(left.length, right.length) - 1;
    return [0,4,9,last].filter((i,j,indices) => i >= 0 && i < left.length && indices.indexOf(i) === j)
      .map(i => ({
        row: i+1,
        leftY: left[i].getBoundingClientRect().top,
        rightY: right[i].getBoundingClientRect().top,
      }));
  });
  if (screenGeometry.length < 2 ||
      screenGeometry.some(row => Math.abs(row.leftY - row.rightY) > 1.5)) {
    throw new Error("Screen table/Gantt row positions differ: " + JSON.stringify(screenGeometry));
  }
  console.log("PASS: Screen table and Gantt positions align in actual pixels.");



  // Hierarkiavärit näkyvät sekä työskentelynäkymässä että A3-tulostuksessa.
  const level0 = page.locator(".gantt-pane .task-bar.level-0").first();
  const level1 = page.locator(".gantt-pane .task-bar.level-1").first();
  if (await level0.count() === 0 || await level1.count() === 0) {
    throw new Error("Expected main task and subtasks to have distinct hierarchy levels.");
  }
  const level0StartColor = await level0.evaluate(el => getComputedStyle(el).backgroundColor);
  const level1StartColor = await level1.evaluate(el => getComputedStyle(el).backgroundColor);
  if (level0StartColor !== "rgb(36, 82, 122)" || level1StartColor !== "rgb(54, 169, 173)") {
    throw new Error("Hierarchy default colors missing: " + level0StartColor + ", " + level1StartColor);
  }
  await page.getByRole("button",{name:/Näkymä/}).click();
  await page.locator('.hierarchy-color-field input[type="color"]').first().fill("#123456");
  await page.locator('.view-panel-close').click();
  const changedColor = await level0.evaluate(el => getComputedStyle(el).backgroundColor);
  if (changedColor !== "rgb(18, 52, 86)") {
    throw new Error("Editable hierarchy color was not applied to Gantt: " + changedColor);
  }
  await page.emulateMedia({ media: "print" });
  const printGeometry = await page.evaluate(() => {
    const sheet = document.querySelector(".report-sheet");
    if (!sheet) return { error: "No print sheet" };
    const leftHead = sheet.querySelector(".report-column-head");
    const rightHead = sheet.querySelector(".report-calendar");
    const left = Array.from(sheet.querySelectorAll(".report-table-row"));
    const right = Array.from(sheet.querySelectorAll(".report-chart-row"));
    if (!leftHead || !rightHead || left.length !== right.length) return { error: "Different row counts" };
    const last = left.length - 1;
    return {
      headers: [leftHead.getBoundingClientRect().height, rightHead.getBoundingClientRect().height],
      rows: [0,4,9,last].filter((i,j,indices) => i >= 0 && i < left.length && indices.indexOf(i) === j)
        .map(i => ({ row: i+1, leftY: left[i].getBoundingClientRect().top,
                     rightY: right[i].getBoundingClientRect().top }))
    };
  });
  if (printGeometry.error ||
      Math.abs(printGeometry.headers[0] - printGeometry.headers[1]) > 1.5 ||
      !printGeometry.rows?.length ||
      printGeometry.rows.some(row => Math.abs(row.leftY - row.rightY) > 1.5)) {
    throw new Error("Print table/Gantt positions differ: " + JSON.stringify(printGeometry));
  }
  console.log("PASS: A3 report headers and rows align in actual pixel coordinates.");

  const printedColor = await page.locator(".report-sheet.hierarchy-colors .report-plan-bar.level-0").first()
    .evaluate(el => getComputedStyle(el).backgroundColor);
  if (printedColor !== "rgb(18, 52, 86)") {
    throw new Error("Editable hierarchy color missing from PDF print layout: " + printedColor);
  }
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button",{name:/Näkymä/}).click();
  const toggle = page.getByRole("checkbox", { name: /Hierarkiatasojen värit/ });
  await toggle.uncheck();
  await page.locator(".view-panel-close").click();
  const oldStyle = await level0.evaluate(el => getComputedStyle(el).backgroundColor);
  if (oldStyle === "rgb(18, 52, 86)") {
    throw new Error("Turning off hierarchy colors did not restore the single-color style.");
  }
  console.log("PASS: Hierarchy color defaults, custom palette, print colors and on/off toggle.");



} catch(error){
  console.error("FAIL: Snedo browser interaction test:",error);
  console.error("Console/network problems:",messages.slice(-25).join("\n"));
  console.error("Server output:",serverOutput.slice(-3000));
  await page.screenshot({path:"browser-smoke-failure.png",timeout:4000}).catch(()=>{});
  process.exitCode=1;
}finally {
  await browser.close();
  server.kill();
}
