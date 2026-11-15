// node video/render.cjs [out.mp4] [fps]   — renders explainer.html frame by frame into an H.264 MP4
// node video/render.cjs --stills dir t1,t2,...  — writes PNG stills for review
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("file://" + path.join(__dirname, "explainer.html"));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  const total = await p.evaluate(() => TOTAL);
  if (process.argv[2] === "--stills") {
    const dir = process.argv[3];
    for (const t of process.argv[4].split(",").map(Number)) { await p.evaluate((t) => renderAt(t), t); await p.screenshot({ path: path.join(dir, `still-${String(t).padStart(5, "0")}.png`) }); }
  } else {
    const out = process.argv[2] || path.join(__dirname, "home-lift-mover-explainer.mp4");
    const fps = +(process.argv[3] || 30);
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
    const n = Math.round(total * fps);
    for (let i = 0; i < n; i++) {
      await p.evaluate((t) => renderAt(t), i / fps);
      const buf = await p.screenshot({ type: "png" });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (i % 300 === 0) console.log(`frame ${i}/${n}`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
    console.log("wrote", out, total + "s");
  }
  console.log("errors:", JSON.stringify(errs));
  await b.close();
})();
