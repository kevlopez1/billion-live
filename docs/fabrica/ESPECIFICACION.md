# La fábrica de videos · especificación de la ola 1

Contrato para cada agente que construye. El comportamiento, las fuentes y los horarios salen del plan
(`kev-project-gta/estrategia-reto/11-FABRICA-DE-VIDEOS.md`): si algo de aquí lo contradice, gana el plan y se corrige aquí.

**Esta ola:** spec, base, guionista con guardas, control de calidad, publicadores (red simulada en los tests), cola con
reserva, reintentos, interruptor y parte diario, panel en `/publicar`, `/privacidad` y `/terminos`.
**Fuera:** voces y audio, flags de GPU en el render, la VM de AWS y el arreglo de los episodios de la temporada.
**No se tocan** (otros agentes): `components/casa-blanca/escena/*`, `components/casa-blanca/estudio/*`,
`scripts/casa-blanca-render.mjs`, `components/casa-blanca/datos/personajes.ts`. Se leen e importan, no se editan.

## 0. Reglas que valen para todo módulo

1. **Reservar antes de mandar.** Todo paso que gasta o publica se reserva con un UPDATE condicional en la base (función SQL,
   `now()` de la base, nunca la hora de Vercel) con dueño y vencimiento. Solo el dueño lo cierra. Nada se marca después de mandar.
2. **Lo ambiguo se mira antes de repetirlo.** Timeout después de enviar, o una reserva vencida en `subiendo`/`publicando`,
   pasa a `ambiguo`. De `ambiguo` solo se sale listando los posts recientes de esa red (`recientes()`); si la lista falla, sigue ambiguo.
3. **Banderas de entorno con `flag()`** (`lib/fabrica/tipos.ts`): `true` solo con `1|true|si|sí|on` (sin mayúsculas ni espacios).
   `"false"`, vacío o ausente = apagado. Todas arrancan apagadas.
4. **Ningún `catch` mudo.** Un catch que devuelve vacío hace `console.error("[fabrica/<modulo>] <qué> falló: <cómo>")` y el vacío
   no se lee como dato. Cada error guardado lleva `{ paso, como, clase, codigo?, cuando }`: el cómo es la respuesta de la red tal cual.
5. **Lo diario se reclama en la base** (`fabrica_reclamar`), un ganador por día. Nada de `setInterval`.
6. **Lógica pura separada de la red y la base.** Cada módulo exporta funciones puras más un ejecutor que recibe sus puertos
   (`fetch`, `base`, `ahora`, `env`) por parámetro. Tests: `npx tsx lib/fabrica/<x>.test.ts`, sin red ni base, salida 1 si falla
   (estilo `lib/publicar-pedido.test.ts`).
7. Texto visible en español neutro (`python3 scripts/sin-voseo.py` → `TOTAL: 0`), pocas palabras, «PRIME» en pantalla con
   `PrimeMark`/`conPrime`, montos solo desde `lib/contador.ts`. `npx tsc --noEmit -p .` sin errores nuevos.
8. Hora: Bolivia es UTC−4 fijo (sin horario de verano). `diaBolivia(ahora)` y `horaBolivia(ahora)` viven en `tipos.ts`.

## 1. Módulos y dueños

| Archivo | Qué hace | Agente |
|---|---|---|
| `lib/fabrica/tipos.ts` | Tipos, `TRANSICIONES`, `flag()`, hora de Bolivia, `FICCION`, `CORREO_BAJAS`, horarios (sección 3) | A |
| `lib/fabrica/semaforo.ts` | El semáforo por personaje como dato + alias para buscarlos en texto | A |
| `lib/fabrica/guardas.ts` | Reparto, contenido prohibido, regla comercial, voseo, textos por red, etiquetas de IA | A |
| `supabase/correr-todo.sql` | Parte 11 (sección 2): tablas, funciones, cron, cambio de `publicaciones` | A |
| `lib/fabrica/base.ts` | Puerto `Base` (interfaz) + implementación con `getAdminClient()` que solo llama `rpc`/`from` | A |
| `lib/fabrica/ideas.ts` | 3–6 ideas (+1 reserva) desde memoria (sin tipo `charla`), conciencia y reflexión; sin par ni tema repetido en 7 días | B |
| `lib/fabrica/guionista.ts` | Idea → `Episodio` JSON con Claude (cliente inyectado) → guardas → segunda pasada Haiku. Hasta 3 intentos | B |
| `lib/fabrica/calidad.ts` | Lee la salida de `ffprobe`/`ffmpeg` (texto) y decide; puro | C |
| `scripts/fabrica/calidad.ts` | CLI: `npx tsx scripts/fabrica/calidad.ts <video.mp4> <episodio.json>` → JSON + código de salida | C |
| `lib/fabrica/redes/{youtube,x,uploadpost,meta-reels}.ts` | Adaptadores (sección 5). `meta-reels.ts` envuelve `lib/meta.ts` | D |
| `lib/fabrica/tokens.ts` | Cifrado AES-256-GCM + reserva y rotación atómica de tokens | D |
| `lib/fabrica/almacen.ts` | Interfaz `Almacen { subir, urlFirmada(ruta, horas≥24), borrar }`; Supabase Storage o Vercel Blob (paso 11 de Kev); simulado en tests | D |
| `lib/meta.ts`, `app/api/publicar/route.ts` | Graph a la versión verificada (override `META_GRAPH_URL` sigue), `is_ai_generated` en la cuenta `casa-blanca`, `content_publishing_limit`, errores con `codigo`/`subcodigo`, listar videos recientes de la página | D |
| `lib/fabrica/cola.ts` | `planDelTick(estado, videos, envios, ahora) → Accion[]` (puro) + `ejecutarTick(puertos)` | E |
| `lib/fabrica/reporte.ts` | Arma el parte (puro) y lo manda por el canal inyectado | E |
| `app/api/fabrica/tick/route.ts` | POST, cada 10 min desde pg_cron, `Bearer FABRICA_CRON_SECRET`, `maxDuration = 60`, presupuesto 45 s | E |
| `app/api/fabrica/estado/route.ts` | GET estado del panel; POST `pausar` / `reanudar` / `ajustar` | E |
| `app/api/fabrica/aprobar/route.ts` | GET pendientes; POST aprobar o rechazar guion o video | E |
| `app/api/fabrica/vigilante/route.ts` | GET para el bot de Prime (sección 6) | E |
| `scripts/fabrica/tanda.ts` | Tanda diaria de la VM: reclamar día → ideas → guiones → `voces()` y `render()` stub → calidad → almacén → subidas pesadas | B (+C, D) |
| `scripts/fabrica/cargar-token.ts` | Cifra y guarda un token a mano (YouTube, X) | D |
| `app/publicar/**` | Sección «Fábrica» (sección 7, agente F) | F |
| `app/privacidad/page.tsx`, `app/terminos/page.tsx` | Páginas legales (sección 7) | F |

Autenticación: el panel y sus rutas usan `autorizado`/`rechazo` de `lib/auth-admin.ts` (solo Kev). `lib/fabrica/auth.ts`
compara `FABRICA_CRON_SECRET` y `FABRICA_VIGILANTE_SECRET` con el mismo sha256 + `timingSafeEqual`.

## 2. Base de datos (parte 11 de `supabase/correr-todo.sql`)

Todo idempotente (`if not exists`, `create or replace`, `on conflict do nothing`), RLS activo y **sin políticas**, funciones
`security definer` con `revoke` a `public`/`anon`/`authenticated` y `grant` a `service_role` (mismo bloque `do $$` que
`casa_blanca_consumir`). Se suman las tablas nuevas a la COMPROBACIÓN del final y se corrige el conteo de la cabecera.

- **`fabrica_videos`**: `id uuid pk`, `creado`, `actualizado`, `dia date` (día de salida, Bolivia), `slot int` (null = reserva),
  `hora_salida timestamptz`, `es_reserva bool`, `estado text check (...)`, `pilar`, `personajes text[]`,
  `semaforo text check (verde|amarillo)`, `idea jsonb`, `episodio jsonb` (un `Episodio` de `guion.ts`, id `fab-AAAAMMDD-n-slug`),
  `guion_hash text`, `textos jsonb` (título y texto por red, ya validados), `avisos text[]`, `archivo text`, `archivo_bytes bigint`,
  `duracion_s numeric`, `calidad jsonb`, `aprobado_guion_por/en`, `aprobado_video_por/en`, `motivo_rechazo`,
  `dueno text`, `trabajo text`, `vence_en timestamptz`, `intentos int`, `errores jsonb` (últimos 20, con el cómo).
  `unique (dia, slot) where slot is not null`; índice por `estado`.
- **`fabrica_envios`** (una fila por video y red; una fila se reserva con un UPDATE simple, un jsonb no):
  `video_id fk on delete cascade`, `red`, `estado text check (pendiente|subiendo|subido|programado|publicando|procesando|ambiguo|publicado|confirmado|no_hoy|fallido|omitido)`,
  `id_red`, `enlace`, `contenedor` (IG), `media_id`, `media_expira_en` (X), `publish_at` (YouTube), `dueno`, `reservado_en`,
  `vence_en`, `intentos`, `proximo_intento`, `visibilidad`, `verificado_en`, `subtitulos text (no_aplica|pendiente|ok|fallido)`,
  `intentos_subtitulos`, `ultimo_error jsonb`. `unique (video_id, red)`.
- **`fabrica_estado`** (una fila, `id bool pk default true check (id)`): `pausada bool default true` (**nace pausada**), `motivo`,
  `pausada_por`, `pausada_en`, `modo_aprobacion bool default true`, `videos_por_dia int default 3 check (1..6)`,
  `tope_gasto_usd_dia numeric default 5` (a decidir por Kev), `dia date`, `gasto_usd_dia`, `publicados_dia`, `fallidos_dia`,
  `redes jsonb` (`{"x": {"pausada": bool, "motivo": text, "fallos_seguidos": int}}`), `ultimo_tick_en`, `ultima_tanda_en`, `ultima_tanda jsonb`.
- **`fabrica_tokens`**: `red text pk`, `cifrado text` (`iv.tag.datos` en base64, clave `FABRICA_CLAVE_TOKENS` de 32 bytes),
  `version int`, `expira_en`, `renovando_hasta`, `actualizado`, `ultimo_error`.
- **`fabrica_candados`**: `(que text, dia date) pk`, `intentos`, `reclamado`, `terminado` (`que` = `tanda` | `parte`).
- **`fabrica_reporte`**: `dia date pk`, `generado_en`, `enviado_en`, `canal`, `resumen jsonb`, `texto`, `error`.

Funciones (la reserva vive aquí, en una sola sentencia, como `casa_blanca_consumir`):
- `fabrica_reservar_video(p_id, p_desde text[], p_trabajo, p_dueno, p_vence_min, p_max_intentos) → fila | null`: gana solo si
  `estado = any(p_desde)`, sin dueño vigente, `intentos < max` y `fabrica_estado.pausada = false`, leído en la misma sentencia.
- `fabrica_terminar_video(p_id, p_dueno, p_hasta, p_campos jsonb) → bool`: cierra solo si `dueno = p_dueno`; limpia el dueño.
- `fabrica_reservar_envio(p_id, p_desde text[], p_en_curso, p_dueno, p_vence_min, p_max_intentos) → fila | null`: además exige
  `proximo_intento <= now()` y la red no pausada. Suma el intento **al reservar** (una caída también cuenta).
- `fabrica_terminar_envio(p_id, p_dueno, p_hasta, p_campos jsonb) → bool`.
- `fabrica_vencidos_a_ambiguo() → int`: `subiendo`/`publicando` con `vence_en < now()` → `ambiguo`. Primera llamada de cada tick y tanda.
- `fabrica_cubrir_hueco(p_dia, p_slot, p_hora) → fila | null`: con `for update skip locked`, la reserva verde más vieja lista
  (y aprobada si hay modo aprobación) toma el slot; el video que no llegó pasa a reserva o queda rechazado.
- `fabrica_sumar_gasto(p_usd) → jsonb`: reinicia contadores si cambió el día; suma **antes** de gastar solo si no pasa el tope;
  si pasa, pausa con motivo `tope de gasto` y devuelve `ok: false`.
- `fabrica_registrar_resultado(p_red, p_ok) → jsonb`: `fallos_seguidos` + 1 o 0; con 2, pausa esa red.
- `fabrica_reclamar(p_que, p_intentos, p_vence_min) → date | null` y `fabrica_terminar_candado(p_que, p_dia)`: como `casa_blanca_reclamar_reflexion`.
- `fabrica_reservar_token(p_red, p_vence_seg) → fila | null` y `fabrica_rotar_token(p_red, p_version, p_cifrado, p_expira) → bool`
  (`where version = p_version`; si da false, otro rotó: se relee).

**Cron:** un bloque `do $$` que programa `fabrica-tick` (`*/10 * * * *`, `net.http_post` a `https://kevproject.world/api/fabrica/tick`,
`timeout_milliseconds := 60000`, cabecera `Bearer` leída de Vault `fabrica_cron`) **solo si** existen `pg_cron`, `pg_net` y ese
secreto; si no, `raise notice` con lo que falta. El secreto nunca va en el repo.

**`publicaciones`** (lo pide la medición, etapa 6): `drop not null` y `drop default` en `vistas`, `likes`, `comentarios`, `compartidos`
(un dato que falta no es un cero); nuevas `fabrica_video_id uuid references fabrica_videos on delete set null`, `id_red`,
`corte text check (corte in ('72h','7d'))`, `como jsonb` (pilar, visor, cámara del plano 1, personajes, voz, música, formato, duración),
`medido_en`; `unique (fabrica_video_id, red, corte) where fabrica_video_id is not null`.
Compatibilidad: `/api/publicaciones` inserta siempre números (no cambia) y lee con `Number(f.vistas)`, que convierte `null` en 0
sin romper. En esta ola nadie escribe `null`. **Antes** de que el lector de métricas (etapa 6) guarde nulos, `aPublicacion` y
`lib/metricas.ts` tienen que usar `oNulo` en esas cuatro y `/centro` contar videos, no filas por corte. Eso queda anotado para la etapa 6
(esos archivos no son de esta ola).

## 3. La máquina de estados

`TRANSICIONES` en `tipos.ts` es la única lista; un test la recorre. La pausa no cambia estados: los bloquea.

| De → a | Quién | Reserva |
|---|---|---|
| (nada) → `idea` | tanda (`ideas.ts`) | `insert` con `unique (dia, slot)`; las de reserva sin slot |
| `idea` → `guion` | tanda | `reservar_video([idea], 'guion', vence 15 min, máx 3)`; 3 guiones que no pasan las guardas → `rechazado` |
| `guion` → `aprobacion_pendiente` (hay amarillo) o `listo_para_render` (todo verde) | tanda, mismo dueño | `terminar_video` |
| `aprobacion_pendiente` → `listo_para_render` / `rechazado` | panel (`aprobar`) | UPDATE `where estado = 'aprobacion_pendiente' and guion_hash = <el que vio Kev>` |
| `aprobacion_pendiente` → `rechazado` (24 h sin respuesta) | tick | UPDATE `where estado = ... and actualizado < now() - 24 h` |
| `listo_para_render` → `renderizado` | tanda (`render()` stub esta ola) | `reservar_video([listo_para_render], 'render', 40 min)` |
| `renderizado` → `calidad_ok` / `rechazado` | tanda (`calidad.ts`) | `reservar_video([renderizado], 'calidad', 10 min)` |
| `calidad_ok` → `subido_parcial` | tanda: archivo en el almacén | `reservar_video([calidad_ok], 'almacen', 20 min)`; luego por red `reservar_envio([pendiente], 'subiendo')` (YouTube privado sin `publishAt`; media de X) |
| `subido_parcial` → `programado` | tanda o tick | cada red activa en `subido` (YouTube, X) o `pendiente` (Meta, TikTok); con modo aprobación, además `aprobado_video_en` |
| `programado` → `publicado` / `fallido` | tick | todos los envíos terminales (`confirmado`, `fallido`, `omitido`); `publicado` si hay al menos un `confirmado` |
| `calidad_ok`/`subido_parcial`/`programado` → `rechazado` | panel, o tick (modo aprobación sin OK a 30 min de la salida) | UPDATE condicional; el tick llama `cubrir_hueco` |
| cualquiera no terminal → `fallido` | quien tenga la reserva, con error `fatal` | `terminar_video` |

**Envíos por red** (tick salvo lo marcado): `pendiente` →(VM) `subiendo` → `subido` →(YouTube, de T−3 h a T) `programado`
→ `publicado` → `confirmado`. Meta, TikTok y X: `pendiente|subido` →(a la hora) `publicando` → `procesando` (contenedor de IG) →
`publicado` → (15 min después, `estado()`) `confirmado` o pausa de esa red si sale privado. Al pausar: `programado` → `subido`
(`videos.update` a privado, sin `publishAt`). `no_hoy` → `proximo_intento` = 00:00 de mañana. Reintentos: máximo 3, espera
10 → 30 → 90 min. Subtítulos de YouTube aparte: el video se marca `subido` antes de `captions.insert` (400 unidades por intento).
Media de X: vence a las 24 h (**SIN VERIFICAR**): la tanda corre a las **22:00 de D−1** y sube X al final; si `media_expira_en`
< salida + 30 min, X queda `omitido` con el cómo. La tanda renueva la media de X de las reservas que vencen en menos de 30 h.

**Horarios** (Bolivia): 3 al día 12:00, 16:00, 21:30; 6 al día 10:00, 12:00, 14:00, 16:00, 21:00, 22:30. Nunca 19:00 hasta el 22-nov.

**Un tick** (presupuesto 45 s, cada paso mira el tiempo que queda): latido (`ultimo_tick_en`) → `vencidos_a_ambiguo` → si pausada:
solo desprogramar YouTube y salir → vencer aprobaciones y cubrir huecos de las próximas 3 h → resolver ambiguos (`recientes()`) →
retomar contenedores de IG → publicar lo que toca (de a uno, reserva primero) → programar `publishAt` de YouTube → verificar
visibilidad → a partir de las 23:00, `reclamar('parte')` y mandar el parte → borrar del almacén lo que todas las redes confirmaron.

## 4. Guardas (datos + funciones, todas devuelven `string[]` en español; vacío = pasa)

**Semáforo** (`semaforo.ts`, test que falla si un personaje de `PERSONAJES` no tiene entrada o si un `real: "vivo"` queda verde):
- `verde`: lincoln, napoleon, leonardo, cleopatra, suntzu, marco, socrates, mason (el Gran Maestro), iluminado, claude, chatgpt.
- `amarillo` (solo con el OK de Kev): kobe, jobs, jesus. Nunca en reserva.
- `vivo` (solo de fondo): thiel, altman, musk, hormozi, amodei, pichai, karp, gadzhi; trump desde el 2026-11-11.
- `fuera`: tate siempre; trump hasta el 2026-11-10 inclusive, **según la fecha de salida**, no la de escritura. Desconocido = `fuera`.
- Cada entrada trae `alias` para buscarlo en texto (`"Musk"`, `"Elon"`, `"Trump"`, `"Kobe"`, `"Bryant"`…).

**`revisarReparto(ep, textos, fechaSalida)`**: `fuera` no aparece en ningún campo ni alias en ningún texto. `vivo`: nunca en
`dialogo.quien`, ni como `seguir`, ni en `toma.personaje`, ni primero en `reunir`, ni solo en `reunir`; su alias nunca en
`titulo`, `rotulo`, diálogo, título del episodio, textos de publicación ni miniatura.
**`reglaComercial`**: si el reparto tiene un `vivo` o `fallecido` (de `personajes.ts`), nada de `PRIME`, `{RECAUDADO}`, `{META}`
ni `\breto\b` en el episodio ni en los textos.
**`revisarContenido`** (patrones como datos, con una prueba por familia): con un vivo o fallecido en el reparto o nombrado:
delitos, juicios, salud, sexo, familia. Siempre: política electoral; una persona real recomendando PRIME, un producto o un
candidato; empresa real (Tesla, SpaceX, OpenAI, Anthropic, Palantir, Google, Apple…) con una cifra en la misma frase; consejos de
plata, salud o leyes; la muerte de Kobe; conspiraciones como hecho; comillas en un diálogo salvo `cita: true` **y** texto igual a
una línea `C(...)` de ese personaje. El prompt del guionista incluye el `limites` de cada personaje.
**`voseo(texto)`**: la lista de `scripts/sin-voseo.py` portada a TS (líneas con `// sin-voseo:ejemplos`); un test lee el `.py` y
exige que estén todas.
**Guion**: `guionValido()` y `avisosDelEpisodio()` del estudio sin errores; `duracionTotal + APERTURA_S + CIERRE_S` entre 60 y 90 s
(61 o más si va a TikTok); título de 48 caracteres o menos; similitud (trigramas) < 0,6 contra los últimos 30 guiones.
**Textos por red** (`textoDe(video, red)` y `textoValido(red, texto)`): primera línea exactamente `FICCION` = «Ficción hecha con IA.
Personajes inspirados en figuras reales; no son ellas ni hablan por ellas.»; título; `kevproject.world/casa-blanca` (**menos en X**);
`#LaCasaBlancaProject` + 2 del pilar. X: rechaza cualquier URL o dominio suelto (`algo.world`, `t.co`, `http`), y 280 caracteres.
Instagram 2.200. Miniatura: 3 palabras o menos, ningún alias de vivo.
**Etiquetas de IA** (`etiquetaIA(red, cuerpo)`; si falta, no se sube): YouTube `status.containsSyntheticMedia = true`;
Instagram `is_ai_generated = true`; TikTok `is_aigc` por Upload-Post (**SIN VERIFICAR**: TikTok queda apagada hasta probarlo);
Facebook y X sin parámetro: la primera línea, el aviso dentro del video y el nombre de la cuenta.

## 5. Adaptadores de red (`lib/fabrica/redes/*`)

```ts
type Clase = "reintentable" | "no_hoy" | "fatal" | "ambiguo"
type Fallo = { ok: false; clase: Clase; como: string; codigo?: string; pendiente?: string }
interface Adaptador {
  red: RedId                                            // = Red de guion.ts
  subir?(v: VideoParaRed, c: Ctx): Promise<{ ok: true; idRed?: string; mediaId?: string; expira?: string } | Fallo>  // solo VM
  publicar(v: VideoParaRed, c: Ctx): Promise<{ ok: true; idRed: string; enlace?: string; contenedor?: string } | Fallo>
  estado(idRed: string, c: Ctx): Promise<{ visibilidad: "publico" | "privado" | "procesando" | "no_existe" | "desconocida"; como: string }>
  recientes(desde: Date, c: Ctx): Promise<{ idRed: string; texto: string; creado: string }[] | Fallo>  // por título en la ventana
  desprogramar?(idRed: string, c: Ctx): Promise<{ ok: true } | Fallo>           // YouTube al pausar
  clasificar(status: number, cuerpo: unknown): Clase                            // pura, con tabla de casos en el test
}
// Ctx = { fetch, env, ahora, token(red), almacen, log }
```
- `no_hoy`: tope de X (10 posts/24 h, 429), `spam_risk_too_many_posts` de TikTok, Meta 9 / 2207042 / 80002, `quotaExceeded` de YouTube.
- `fatal`: token inválido tras renovar (Meta 190, `invalid_grant`, X 401), falta de permiso (Meta 10/200), formato rechazado.
- `ambiguo`: corte después de enviar el cuerpo; Facebook `/videos` sin respuesta (hoy `lib/meta.ts` ya lo dice en texto: pasa a ser clase).
- `reintentable`: 5xx, error de red antes de enviar, Meta 1/2.

| Red | Variables (solo nombres) |
|---|---|
| YouTube | `FABRICA_YT_CLIENT_ID`, `FABRICA_YT_CLIENT_SECRET`; token en `fabrica_tokens` |
| X | `FABRICA_X_CLIENT_ID`, `FABRICA_X_CLIENT_SECRET`; refresh de un solo uso en `fabrica_tokens` (reservar → renovar → rotar; si se cae entre medio, el parte pide reautorizar) |
| Instagram / Facebook | `CASA_BLANCA_META_TOKEN`, `CASA_BLANCA_META_PAGE_ID`, `META_GRAPH_URL` (opcional) |
| TikTok | `FABRICA_UPLOADPOST_KEY`, `FABRICA_UPLOADPOST_USUARIO` |
| Comunes | `FABRICA_ACTIVA`, `FABRICA_<RED>_ACTIVA`, `FABRICA_CRON_SECRET`, `FABRICA_VIGILANTE_SECRET`, `FABRICA_CLAVE_TOKENS`, `FABRICA_ANTHROPIC_KEY`, `FABRICA_MODELO_GUION`, `FABRICA_MODELO_REVISION`, `FABRICA_ALMACEN`, `FABRICA_BUCKET`, `FABRICA_AVISO_URL`, `FABRICA_AVISO_SECRET`, `FABRICA_PAUSA_EQUIPO` |

Pendiente de verificar en la documentación de Upload-Post: si acepta una URL o exige el archivo (si exige el archivo, la
subida de TikTok no entra en Vercel y hay que decidir antes de activarla).

## 6. Parte diario y vigilante

**Parte** (`fabrica_reporte`, un `reclamar('parte')` por día, desde las 23:00): día; producidos (por estado final); publicados por
red con enlace; fallidos con el cómo; en privado inesperado; `no_hoy`; aprobaciones pendientes y vencidas; reserva verde (aviso si < 3);
gasto del día contra el tope; redes y fábrica pausadas con motivo; tokens que fallaron al renovar; tanda de anoche (empezó, terminó,
cuántos por paso); último tick. Se guarda **antes** de mandar; `enviado_en` se escribe solo si el canal confirmó. Canal: POST a
`FABRICA_AVISO_URL` (bot de Prime o correo, lo decide Kev); sin canal, queda guardado y lo dice.

**Vigilante:** `GET /api/fabrica/vigilante` con `Bearer FABRICA_VIGILANTE_SECRET`, solo lectura:
`{ ahora, ultimo_tick_en, ultima_tanda_en, pausada, motivo, parte: { dia, generado_en, enviado_en } | null, reserva_verde }`.
El bot de Prime lo consulta a las 23:30: si no contesta, `ultimo_tick_en` tiene más de 30 min o no hay parte enviado, avisa a Kev
y a la segunda persona. La misma clave puede `POST /api/fabrica/estado {accion: "pausar", motivo}` (pausar sí, reanudar nunca),
para el correo de una plataforma. `FABRICA_PAUSA_EQUIPO` nombra a quien del equipo (`quien()`) puede pausar; reanudar es solo de Kev.

## 7. Qué entrega cada agente

| Agente | Entrega | Pruebas (sin red ni base) |
|---|---|---|
| **A · Base y guardas** | `tipos.ts`, `semaforo.ts`, `guardas.ts`, `base.ts`, parte 11 del SQL | `semaforo.test.ts`: los 24 personajes, vivos nunca verdes, Trump por fecha. `guardas.test.ts`: un vivo con diálogo falla; Kobe con `{RECAUDADO}` falla; URL en X falla; primera línea distinta falla; una prueba por familia prohibida; los 19 episodios de `CALENDARIO` corren sin excepción (se reportan, no se arreglan aquí). `tipos.test.ts`: `flag("false") === false`, transiciones |
| **B · Guionista y tanda** | `ideas.ts`, `guionista.ts`, `scripts/fabrica/tanda.ts` con `voces()` y `render()` stub | Modelo falso: JSON roto → reintento; guion que falla guardas 3 veces → `rechazado`; amarillo → `aprobacion_pendiente`; sin memoria de tipo `charla`; pausada → la tanda no avanza |
| **C · Calidad** | `calidad.ts` + CLI | Salidas de `ffprobe`/`blackdetect`/`freezedetect`/`volumedetect` guardadas como texto: duración ±0,5 s, negros, congelados, renderer no NVIDIA, peso sobre el límite → `rechazado` con el cómo |
| **D · Redes** | adaptadores, `tokens.ts`, `almacen.ts`, cambios en `lib/meta.ts` | `fetch` falso: cada red manda su etiqueta de IA; X sin URL; `clasificar` con tabla; timeout → `ambiguo`; rotación de token con versión vieja → relee; `lib/publicar-pedido.test.ts` sigue pasando |
| **E · Cola y rutas** | `cola.ts`, `reporte.ts`, rutas `tick`, `estado`, `aprobar`, `vigilante` | `planDelTick` puro: pausada → solo desprogramar; reserva perdida → no se manda; ambiguo → `recientes` antes de reintentar; 2 fallos → red pausada; tope de gasto → pausa; hueco → reserva verde; parte una vez por día; ruta sin clave → 401 |
| **F · Panel y legales** | Sección «Fábrica» en `/publicar`: pausar/reanudar con motivo, contadores del día, reserva, cola de hoy y mañana con el estado por red, aprobaciones (guion con `conPrime`; video con URL firmada), último parte. `/privacidad` y `/terminos` | `sin-voseo.py` → 0; sin `\bPRIME\b` suelto en pantalla; `tsc` sin errores nuevos. Las legales nombran el uso de los servicios de la API de YouTube con enlace a los Términos de YouTube y a la Política de Privacidad de Google, cómo revocar el acceso, qué datos se guardan y la baja en menos de 24 h por `CORREO_BAJAS` (Kev confirma que el buzón existe antes de aprobarlas, pasos 2 y 12) |

Orden: A primero (los demás importan sus tipos); B, C, D en paralelo; E cuando haya adaptadores; F cuando E tenga `estado` y `aprobar`.
Cada agente corre su test, `npx tsc --noEmit -p .` y `python3 scripts/sin-voseo.py` antes de darse por terminado.
