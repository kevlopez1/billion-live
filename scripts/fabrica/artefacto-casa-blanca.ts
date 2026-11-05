// Arma una copia estática de /fabrica?canal=casa-blanca para el panel de Claude.
// Uso: npx tsx scripts/fabrica/artefacto-casa-blanca.ts <salida.html>
import { writeFileSync } from "node:fs"
import { FABRICA_CASA_BLANCA_BASE as doc } from "@/lib/fabrica-casa-blanca"

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const flujo = () => {
  const cajas = doc.pasos
    .map((p) => `<div class="paso${p.kev ? " kev" : ""}"><b>${esc(p.titulo)}</b><span>${esc(p.detalle)}</span></div>`)
    .join('<div class="flecha">↓</div>')
  const vueltas = doc.retornos
    .map((r) => `<li${r.punteado ? ' class="punteado"' : ""}>${esc(doc.pasos[r.desde].titulo)} → ${esc(doc.pasos[r.hasta].titulo)}: ${esc(r.etiqueta)}</li>`)
    .join("")
  return `<div class="flujo">${cajas}</div><p class="etiqueta">Vueltas atrás</p><ul class="vueltas">${vueltas}</ul>`
}

const cuerpo = doc.secciones
  .map((s) => {
    let html = ""
    switch (s.tipo) {
      case "flujo": html = flujo(); break
      case "lista": html = s.items.length ? `<ol class="lista">${s.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>` : `<p class="estado">Todavía vacío.</p>`; break
      case "tabla": html = s.filas.length
        ? `<div class="tablaCont"><table class="tabla"><thead><tr>${s.columnas.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${s.filas.map((f) => `<tr>${f.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
        : `<p class="estado">Todavía vacío.</p>`; break
      case "referentes": html = `<p class="estado">${s.refs.length ? "" : "Todavía no hay."}</p>`; break
      case "guiones": html = `<p class="estado">${s.guiones.length ? "" : "Todavía no hay guiones generados."}</p>`; break
      case "metricas": html = `<p class="estado">Todavía no hay métricas cargadas.</p>`; break
      case "notas": html = `<p class="estado">Sin notas. Para escribir, entra a la web.</p>`; break
    }
    return `<section class="seccion" id="${s.id}"><span class="etiqueta">${esc(s.etiqueta)}</span><h2 class="h2">${esc(s.titulo)}</h2>${html}</section>`
  })
  .join("\n")

const botones = doc.secciones.map((s) => `<a href="#${s.id}">${esc(s.etiqueta)}</a>`).join("")

const html = `<!DOCTYPE html>
<html lang="es">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fábrica · Casa Blanca</title>
<style>
:root { --negro:#000; --caja:#141414; --linea:#333; --tinta:#fff; --gris:#a3a3a3; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; background:var(--negro); color:var(--tinta); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; font-size:16px; line-height:1.5; padding:40px 16px 80px; }
main { max-width:900px; margin:0 auto; display:flex; flex-direction:column; gap:40px; }
.cabecera { display:flex; flex-direction:column; gap:12px; }
h1 { font-size:clamp(28px,5vw,40px); margin:0; line-height:1.1; }
.bajada { color:var(--gris); max-width:65ch; margin:0; }
.vivo { font-size:13px; color:var(--gris); }
.vivo a { color:var(--tinta); }
.etiqueta { font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--gris); }
.botones { display:flex; flex-wrap:wrap; gap:8px; }
.botones a { color:var(--gris); text-decoration:none; border:1px solid var(--linea); border-radius:999px; padding:6px 14px; font-size:14px; }
.botones a:hover { color:var(--tinta); border-color:var(--tinta); }
.h2 { font-size:clamp(22px,3.6vw,28px); font-weight:600; margin:0; }
.seccion { display:flex; flex-direction:column; gap:18px; padding-top:32px; border-top:1px solid var(--linea); scroll-margin-top:16px; }
.estado { font-size:13px; color:var(--gris); margin:0; }
.lista { margin:0; padding-left:26px; display:flex; flex-direction:column; gap:10px; font-size:17px; max-width:70ch; }
.lista li::marker { color:var(--gris); }
.tablaCont { overflow-x:auto; }
.tabla { width:100%; border-collapse:collapse; font-size:15px; min-width:520px; }
.tabla th { text-align:left; font-weight:500; color:var(--gris); font-size:12px; letter-spacing:.08em; text-transform:uppercase; padding:8px 10px; border-bottom:1px solid var(--linea); }
.tabla td { padding:10px; border-bottom:1px solid #1f1f1f; vertical-align:top; }
.flujo { display:flex; flex-direction:column; align-items:center; }
.paso { width:min(420px,100%); border:1px solid var(--tinta); background:var(--caja); padding:12px 16px; text-align:center; display:flex; flex-direction:column; gap:4px; }
.paso b { font-size:18px; }
.paso span { color:#ccc; font-size:14px; }
.paso.kev { border-style:dashed; }
.flecha { color:var(--gris); padding:4px 0; }
.vueltas { margin:0; padding-left:20px; color:#ccc; display:flex; flex-direction:column; gap:6px; }
.vueltas .punteado { color:var(--gris); font-style:italic; }
</style>
<main>
<header class="cabecera">
<span class="etiqueta">La Casa Blanca Project</span>
<h1>${esc(doc.titulo)}</h1>
<p class="bajada">${esc(doc.bajada)}</p>
<p class="vivo">Copia de <a href="https://kevproject.world/fabrica?canal=casa-blanca">kevproject.world/fabrica?canal=casa-blanca</a>. Para editar o escribir notas, entra ahí.</p>
<nav class="botones">${botones}</nav>
</header>
${cuerpo}
</main>
</html>
`
writeFileSync(process.argv[2], html)
console.log("listo:", process.argv[2], html.length, "bytes")
