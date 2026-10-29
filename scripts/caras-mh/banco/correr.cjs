// Banco de las caras MakeHuman (offline, código propio). Arma el bundle de banco.mts con el código
// del repo, sirve el banco y public/casa-blanca/caras/ por HTTP y abre Chromium (WebGL por software).
// Uso (desde la raíz del repo):
//   node scripts/caras-mh/banco/correr.cjs <salida.png> "<query>" [<salida2.png> "<query2>"]...
//   hornear el pelo de hoy:  ... /tmp/x.png "modo=hornear&ids=trump,musk"   → escribe <id>/pelo-hoy.{bin,json}
//   ver caras / cuellos:     ... /tmp/x.png "modo=ver&ids=trump&horas=12,17.5&encuadre=cuello"
// Necesita Playwright (npx playwright install chromium) y esbuild (node_modules o `npx esbuild@0.28.2`).
const path = require("path"), fs = require("fs"), http = require("http"), { execFileSync } = require("child_process")
const REPO = path.resolve(__dirname, "../../..")
const BANCO = __dirname
const CARAS = path.join(REPO, "public/casa-blanca/caras")
let chromium
try { ({ chromium } = require("playwright")) } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")) }
const local = path.join(REPO, "node_modules/.bin/esbuild")
const [cmd, pre] = fs.existsSync(local) ? [local, []] : ["npx", ["--yes", "esbuild@0.28.2"]]
execFileSync(cmd, [...pre, path.join(BANCO, "banco.mts"), "--bundle", "--outfile=" + path.join(BANCO, "app.js"), "--log-level=warning", "--tsconfig=" + path.join(REPO, "tsconfig.json")], { stdio: "inherit", cwd: REPO })
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".bin": "application/octet-stream" }
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0])
  const raiz = u.startsWith("/casa-blanca/caras/") ? path.join(REPO, "public") : BANCO
  const f = path.join(raiz, u.startsWith("/casa-blanca/caras/") ? u : u.replace(/^\/banco/, ""))
  if (!f.startsWith(raiz)) { res.writeHead(403); return res.end() }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end() } res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" }); res.end(b) })
})
srv.listen(0, async () => {
  const port = srv.address().port
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] })
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i += 2) {
    const p = await b.newPage({ viewport: { width: 800, height: 600 } })
    const errs = []
    p.on("console", (x) => { if (x.type() === "error" || x.type() === "warning" || x.text().startsWith("ERROR")) errs.push(x.text().slice(0, 600)) })
    p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message))
    const t0 = Date.now()
    await p.goto(`http://127.0.0.1:${port}/banco/index.html?caras=hoy&${args[i + 1]}`)
    try { await p.waitForFunction("window.listo === true", null, { timeout: 1800000, polling: 500 }) } catch { errs.push("TIMEOUT") }
    const png = await p.evaluate("window.png")
    if (png) fs.writeFileSync(args[i], Buffer.from(png.split(",")[1], "base64"))
    const extra = await p.evaluate("window.extra || null")
    if (extra) for (const [f, b64] of Object.entries(extra)) {
      const dst = path.join(CARAS, f)
      if (!dst.startsWith(CARAS)) continue
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      fs.writeFileSync(dst, Buffer.from(b64, "base64"))
      console.log("  escrito", path.relative(REPO, dst), fs.statSync(dst).size)
    }
    console.log(args[i], ((Date.now() - t0) / 1000).toFixed(1) + "s", JSON.stringify(await p.evaluate("window.info")))
    if (errs.length) console.log(errs.slice(0, 20).join("\n"))
    await p.close()
  }
  await b.close()
  srv.close()
})
