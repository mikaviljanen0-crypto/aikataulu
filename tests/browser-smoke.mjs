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
