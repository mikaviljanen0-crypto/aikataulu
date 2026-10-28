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
const page = await browser.newPage();
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
  console.log("Page title:", await page.title());
  console.log("Document readyState:", await page.evaluate(() => document.readyState));
  await page.getByRole("button", {name:"Projektit", exact:true}).first().click({timeout:20000});
  await page.getByRole("dialog",{name:"Projektit"}).waitFor({timeout:12000});
  console.log("PASS: React hydration and Projektit button work.");
  await page.getByRole("button",{name:"Luo",exact:true}).first().isVisible();
  console.log("PASS: Project dialog rendered.");
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
