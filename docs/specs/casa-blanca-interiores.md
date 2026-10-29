# Casa Blanca: interiores que se recorren (spec, 2026-10-29)

> Kev: «Dentro de la casa vi que no se puede entrar. Toda parte de la casa debe ser funcional.»

**Hoy:** cada sala es un `dentro(...)` en `lugares.ts` cuyo rectángulo es el edificio entero. Los
residentes desaparecen (tramos `oculto` a 8 m/s), no hay geometría adentro y «seguir» los muestra en
rayos X a través de la fachada. **Meta:** entrar a cada edificio, ver cada sala amueblada, con su luz
y su `dato`, y seguir a los residentes por cuartos, pasillos y escaleras de verdad.

## 1. Plantas y salas (medidas aproximadas, metros, ejes de `tipos.ts`: +x este, +z sur)
Fuente única nueva: **`components/casa-blanca/plantas.ts`** (`PLANTAS`, `CUARTOS`, puertas y escaleras).
`lugares.ts` deriva de ahí los rectángulos de los lugares y los nodos del grafo; la escena, el mapa y
«Cómo llegar» leen lo mismo. Interior útil de la Residencia: x −24,9..24,9, z −12,3..12,3 (muro 0,7).
Alturas del modelo (`arquitectura.ts`, `Y`): Planta Baja y = 0; Estado y = 3,45 (`principalSur`);
Segundo piso y = 8,6 (`balcon`); Tercer piso y = 13,9 (bajo la balaustrada, `cornisa` 16,8).
«Estadio» = rectángulo + medio círculo de r 3,6 con centro en (0, 13): el arco `R_BOW` de la fachada.

**Residencia · Planta Baja (y 0)**
| Sala | Rect x0..x1, z0..z1 | Nota |
|---|---|---|
| Corredor central (abovedado) | −20..20, −1,5..2,5 | eje este-oeste; `res-int` pasa a ser su nodo central, visible |
| Recepción Diplomática | estadio −3,6..3,6, 2,8..16,6 | puerta al Pórtico Sur en el arco: `puerta-res-sur` pasa a (0, 0, 17,2) |
| Sala de Mapas | −11..−3,9, 2,8..12,3 | oeste del óvalo |
| Sala de la Porcelana | 3,9..11, 2,8..12,3 | este del óvalo |
| Biblioteca · Sala Vermeil | −9..−2,7 · 2,7..9, −12,3..−1,8 | a los lados del hall de la escalinata norte |
| Hall de la escalinata norte | −2,4..2,4, −12,3..−1,8 | ver «compromiso» abajo |
| Cocina | −24,9..−15,5, −12,3..−1,8 | noroeste |
| Núcleo oeste (escalera + ascensor familiar) | −15,2..−11,2, −12,3..−6,5 | el mismo en las cuatro plantas |
| Galería oeste | −24,9..−20, 2,8..8 | puerta a la Columnata en (−25,6, 0, 5,5) |
Verificar contra el plano público (Ground Floor) la ubicación de Porcelana, Vermeil y Biblioteca antes de B.

**Residencia · Planta de Estado (y 3,45, techo 5,15 m)**
| Sala | Rect | Nota |
|---|---|---|
| Salón Este | 14,2..24,9, −12,3..12,3 | 10,7 x 24,6 (real 11,1 x 24,1) |
| Gran Corredor | −14..14,2, −1,4..3,6 | separado del Vestíbulo por una fila de columnas |
| Vestíbulo de entrada | −9..9, −12,3..−1,4 | con el hueco de la escalinata norte |
| Gran Escalera | 9,3..14, −12,3..−1,4 | dos tramos con descanso al Segundo piso |
| Salón Rojo · Salón Azul · Salón Verde | −13,7..−3,9 · estadio · 3,9..13,9 (z 3,9..12,3) | Azul llega a z 16,6 por el arco |
| Comedor de Estado | −24,9..−14,3, −2,3..12,3 | 10,6 x 14,6 (real 11 x 14,6) |
| Comedor Familiar | −24,9..−15,5, −12,3..−5,9 | con la despensa al sur |

**Segundo piso (y 8,6):** Sala Central (−20..20, −2,5..2,5), Sala Oval Amarilla (estadio, puerta al
Balcón Truman: nodo `balcon`), Sala de los Tratados (3,9..11,5, 2,8..12,3), Dormitorio Lincoln
(11,8..19,5, 2,8..12,3), Dormitorio de la Reina (11,8..19,5, −12,3..−2,8), Sala Este (19,8..24,9,
−6..6), Sala Oeste (−24,9..−19,8, −6..6), habitaciones de la familia (dormitorio principal
−19,5..−11,8, 2,8..12,3; estudio −11,5..−3,9, 2,8..12,3; comedor presidencial −19,5..−11,8, −12,3..−2,8).
**Tercer piso (y 13,9):** pasillo, Solario (−6..6, 4..12,3, vidrio, terraza sobre el Pórtico Sur) y
dos cuartos de huéspedes.

**Ala Oeste (x −80..−50, z −15..18).** Principal (y 0): Despacho Oval (el óvalo de `HUELLAS.despachoOval`,
puerta oeste), Secretarías (−62..−57,8, 10,5..17,6), Sala Roosevelt (−70..−62,3, 5..12, sin ventanas),
Sala del Gabinete (−63..−54, 0,5..9,8, mira al Jardín de las Rosas), Sala de las Palmas (−53,8..−50,4,
2..9,5, puerta a la Columnata, nodo `col-o`), Sala de Prensa (−62..−50,4, −14,6..−2,5), vestíbulo
noroeste (−79,6..−68, −14,6..−6), oficinas al oeste (Vicepresidente, Jefe de Gabinete, Seguridad
Nacional: −79,6..−70,3, −5..17,6), corredor y escalera central (−66..−63, −2..1). **Sótano (y −3,4):**
Sala de Crisis (−79,6..−66, 4..17,6) y comedor de la Marina (−65..−55, 4..12).
Compromiso: la Sala de Prensa real está en la Terraza Oeste, entre el Ala y la Residencia; aquí va en
la esquina noreste del Ala para no cambiar el exterior. El `dato` no se toca.

**Columnata Oeste:** ya se camina por fuera; se suma solo lo que se pueda documentar en su muro.
**Edificio Eisenhower:** vestíbulo (piso de damero) tras `puerta-eeob` + la Oficina Ceremonial del
Vicepresidente (en la real, segundo piso: va arriba, con una escalera). **Tesoro:** vestíbulo tras
`puerta-tesoro` + la Sala del Efectivo (Cash Room). Un `dato` nuevo solo si es verificable; si no,
la sala lleva cartel y no es `Lugar`. Ojo: el id `biblioteca` ya es del Subsuelo 3 (usar `biblioteca-res`).

**Compromiso de la entrada norte:** en la real el terreno norte está a la altura del piso de Estado;
aquí el suelo es plano y la puerta norte está a 0,45 m. La puerta da a un hall de Planta Baja con una
escalinata de mármol de 3 m (17 escalones, 5 m) que sube al Vestíbulo por un hueco con baranda.

## 2. Cómo se entra: corte por edificio y por planta
- **No hay `NivelId` nuevos.** Las plantas viven dentro de `superficie`: `PlantaId` = `res-baja`,
  `res-estado`, `res-segundo`, `res-tercero`, `oeste-principal`, `oeste-sotano`, `eeob-baja`,
  `eeob-alta`, `tesoro-baja`. `nivelDeY`, `mostrarNivel`, el radar por nivel y el ascensor no cambian
  (y −3,4 del sótano sigue siendo `superficie` porque −3,4 > −4).
- **Escena** (`escena/interiores.ts`, nuevo): `mostrarPlanta(p | null, { corte? })` y `planta()`.
  Con una planta P del edificio B: (1) a las piezas exteriores de B (`arquitectura.ts` las marca con
  `userData.edificio`) se les cambia el material por un clon con `clippingPlanes` en y = P.y + corte
  (2,7 m) y `renderer.localClippingEnabled`: la fachada real queda cortada a esa altura, sin
  geometría nueva; los clones se cachean. (2) Remate oscuro sobre el corte del muro exterior, como el
  subsuelo. (3) Se ve el grupo de P (muros interiores cortados a 2,7 m, pisos, muebles); las plantas
  de arriba se ocultan y las de abajo no se dibujan (las tapa la losa). Los demás edificios y los
  jardines siguen igual; con `p = null` todo vuelve al exterior. Cambio de planta = fundido corto.
- **Construcción perezosa:** el interior de un edificio se arma la primera vez que se entra (nunca en
  la carga). `Lote` y el material «maqueta» salen de `subsuelo.ts` a `escena/lote.ts` (se mueven, no se
  copian). Por planta: 1 malla fusionada (color, rugosidad y brillo por vértice), 1 atlas de pisos y
  alfombras (parquet del Salón Este, damero, alfombra oval), `InstancedMesh` por mueble repetido
  (sillas, butacas de prensa, lámparas), 1 malla de vidrio y emisivos. Sin luces reales nuevas: de
  noche, emisivos con `ctx.alAnochecer` (lámparas, ventanas, un tono cálido del piso). Tope: ≤ 40
  draw calls y ≤ 150 mil triángulos por planta en calidad media.
- **Interfaz:** tocar un edificio o una sala abre su panel con «Entrar»; adentro, el HUD muestra los
  pisos del edificio (Tercer piso … Planta Baja; Principal / Sótano) y «Salir». En el mapa, cada
  edificio de la superficie despliega sus plantas y salas (con cuántos residentes hay en cada una).
- **Cómo llegar** (`navegacion.ts`): sale del grafo (camino desde la puerta del edificio): «Entra por
  el Pórtico Sur» → «Escalera oeste a la Planta de Estado» → «Al sur del Gran Corredor». Paso nuevo
  `tipo: "escalera"`. El ascensor del subsuelo no cambia; `asc-sup` pasa al pabellón (0, 0, 31): para
  bajar se sale por el Pórtico Sur, como muestra la cámara.

## 3. Simulación
- `NodoGrafo` y `Lugar` ganan `planta?: PlantaId`; `Lugar` gana `zonas` (rectángulos libres de muebles
  donde se para o camina la gente) y `asientos` ({x, z, rumbo} para «sentado»: gabinete, comedores,
  prensa). Mismos ids de lugar: los horarios no cambian; cambian rect, `y`, `acceso` y nodos.
- Nodos reales en cada puerta, pasillo y descanso. Una escalera es una arista `escalera: true`
  (rampa en 3D; dos tramos = tres nodos). Fuera del grafo se camina solo dentro de un mismo cuarto.
- Nada adentro es `oculto` (salvo plantas que aún no existen en la escena: `lista: false` en
  `plantas.ts`, que conservan la regla vieja hasta su paso). Adentro se camina a 1,4–3,5 m/s.
- `EstadoPj.planta` (la del tramo o del lugar). `visible` = se puede mostrar en alguna vista.
  `vagar` y las charlas de guion valen en salas con `planta` (una reunión en el Gabinete se ve).
- Motor: un avatar se dibuja si su nivel es el actual **y** su planta es la que se ve (`null` = vista
  exterior). Los rayos X quedan solo para el seguido en un tramo `oculto` (el ascensor).
- Tests nuevos en `simulacion.test.ts`: todo el que está adentro tiene planta; cada punto interior cae
  en un cuarto o pasillo de su planta; ningún tramo interior cruza un muro (va por puertas); nadie
  visible pasa de 5 m/s; todos los lugares se alcanzan. `estudio.test.ts` y `vidas.test.ts` en 0.

## 4. Cámara
- **Entrar:** `encuadreDe(lugarId)` devuelve también `planta`; `encuadrar` de una sala entra a su
  planta (con `corte`, en el acto: el estudio sigue determinista) y encuadra la sala desde el sur, a
  ~55°, distancia max(14, lado x 1,4 + 6). Entrar a un edificio sin sala: su planta principal entera.
- **Seguir adentro:** si la planta del seguido cambia (puerta, escalera), la cámara cambia de planta
  con fundido, como hoy cambia de nivel (con histéresis a mitad de escalera). Altura mínima: piso +
  corte + 0,8 m, inclinación ≥ 35°, distancia 5–7 m: siempre por encima de los muros cortados.
- Salir por una puerta exterior devuelve la vista exterior. La intro, las tomas y la luz de noche
  no cambian.

## 5. Orden de construcción
**A · El sistema de corte + Planta de Estado + la simulación.** `plantas.ts`, `escena/lote.ts`,
`escena/interiores.ts`, clipping del exterior, HUD de pisos, «Entrar/Salir», seguir adentro, nodos y
zonas de las cinco salas de Estado más Vestíbulo, Gran Corredor, Comedor Familiar y escalinata norte.
Prueba: capturas (390x844 calidad media y escritorio, de día y de noche) de las cinco salas con
muebles y residentes caminando; seguir a uno del Pórtico Norte al Salón Azul; draw calls y triángulos
antes y después de entrar; la primera carga igual que hoy; los tres tests en 0; `tsc` sin errores
nuevos; `sin-voseo` TOTAL 0.
**B · El resto de la Residencia + escaleras.** Planta Baja, Segundo y Tercer piso, Gran Escalera y
escalera oeste, `asc-sup` al pabellón, mapa con plantas y «Cómo llegar» con escaleras. Prueba:
captura de cada planta; seguir a alguien que sube de la Recepción Diplomática a la Sala Oval Amarilla
y sale al Balcón Truman sin cortes raros; todos los lugares de la Residencia alcanzables en el test.
**C · Ala Oeste, Columnata, Eisenhower y Tesoro.** Principal y sótano del Ala Oeste (escritorio
Resolute, mesa del Gabinete, butacas y atril de prensa, Sala de Crisis), vestíbulos y salas de EEOB y
Tesoro; se borran los últimos `oculto` de superficie y los rayos X fuera del ascensor. Prueba: el
test recorre todo, capturas de cada sala, fps en 390x844 media sin caer respecto de hoy.

## Estado del paso A (2026-10-29)
Hecho: `plantas.ts` (Planta de Estado: 13 cuartos, 19 puertas, muros, macizos del óvalo, ventanas, muebles,
asientos y obstáculos), `escena/lote.ts` (movido de `subsuelo.ts`), `escena/interiores.ts` (corte con
clones de materiales y `clipShadows`, remate, pisos con textura, alfombras, luz de arañas de noche),
sala por sala con «Entrar», barra de plantas con «Salir», seguir adentro (la cámara se inclina hasta ver
por encima de los muros: `vistaTapada`) y «Cómo llegar» sacado del grafo.
Ajustes respecto de lo escrito arriba:
- Muebles fusionados en la malla de la planta en vez de `InstancedMesh`: una sola llamada en lugar de una
  por tipo (la planta entera son 6 mallas y unos 40 mil triángulos).
- Cada puerta tiene dos nodos (uno a cada lado): se cruza derecho y nadie corta un muro en diagonal.
- La Planta Baja todavía no existe: entrar por el Pórtico Sur o la Columnata sigue oculto hasta la
  escalera oeste (`ENLACES`, `oculto: true`). Por la puerta norte se ve todo el camino.
- El muro sur de la fachada se abrió en el arco del Salón Azul y la imposta de la planta baja ya no lo cruza.

## Estado del paso B (2026-10-29)
Hecho: las cuatro plantas de la Residencia se recorren a la vista (`plantas.ts`: Planta Baja 15 cuartos,
Segundo piso 13, Tercer piso 13; muebles nuevos: cama, escritorio, estante, vitrina, cocina, billar,
cinta y mapa de pared).
- **Mismo esqueleto en las cuatro plantas:** el corredor en z −1,4..3,6, el óvalo al centro del lado sur
  (Recepción Diplomática, Salón Azul, Sala Oval Amarilla) y el núcleo oeste (escalera y ascensor) en
  x −14..−9,3, z −12,3..−6,5. Los muros de carga caen uno sobre otro; los tabiques evitan las ventanas.
- **Escaleras en U** (`ESCALERAS`): escalera oeste Baja → Estado → Segundo → Tercero (apiladas en la misma
  caja) y Gran Escalera Estado → Segundo. Cuatro nodos por escalera; se cambia de planta a mitad del
  segundo tramo. Arriba, el pozo no tiene piso (`pozosDe`) y se ven los tramos de abajo; un muro de alma
  separa los dos tramos. La escalera de la Planta Baja al Estado no es la Gran Escalera (la real baja
  por el lado este): aquí se sube por la oeste.
- **Entradas, todas a la vista** (`ENLACES`): puerta norte (escalinata), Pórtico Sur (por la ventana
  francesa del arco a la Recepción Diplomática) y Columnata Oeste (puerta oeste, z 4,8). El Balcón
  Truman pasó a ser un cuarto `exterior` del Segundo piso: se sale por la ventana francesa de la Sala
  Oval Amarilla y la cámara lo ve con el corte (desde afuera lo tapaba el techo del pórtico). Se borró el
  nodo oculto `res-int` (y `balcon`); `asc-sup` pasó al pabellón (0, 0, 31), a la vista.
- **El arco sur sube hasta la cornisa:** en el Tercer piso es el mirador del Solario (cuarto oval abierto
  al Solario); sin él, desde arriba se veía el pasto a través del arco.
- **Habitaciones:** donde duermen los residentes son los dormitorios de huéspedes del Tercer piso. Se
  sube a la vista hasta la puerta; adentro, con la puerta cerrada, no se ve (no hay pose de acostado
  todavía) y no se muestra en rayos X.
- **Ubicación verificada contra el plano público:** al sur Mapas, Recepción Diplomática y Porcelana (la
  Recepción tiene puertas a las dos); Biblioteca y Vermeil al norte, a los lados de la escalinata. Las
  salas sin dato verificable llevan nombre genérico (Oficinas) y no son lugares.
- **Cómo llegar:** elige la puerta que queda más cerca por dentro y nombra las escaleras («Escalera oeste
  al Tercer piso»). El mapa agrupa las salas de cada edificio por planta.

## Estado del paso C (2026-10-29)
Hecho: todo edificio se recorre a la vista. Ya no queda ningún lugar «el edificio entero» (salvo las
habitaciones, con la puerta cerrada) ni ningún tramo oculto en el grafo fuera del ascensor; los rayos X
quedan solo para el ascensor. Datos en `plantas-edificios.ts` (mismo formato que `plantas.ts`, que los suma).
- **Ala Oeste, planta principal (y 0):** vestíbulo tras la puerta norte (x −65), Sala de Prensa al noreste
  (fondo azul con el óvalo, atril y 49 butacas en 7 filas de 7), Oficina del Asesor de Seguridad Nacional,
  pasillo este-oeste, Oficinas del Vicepresidente y del Jefe de Gabinete al oeste, Sala Roosevelt en el
  centro (sin ventanas), pasillo sur hasta la puerta sur (x −62), Sala del Gabinete (mesa de 16 sillas),
  Sala de las Palmas con la puerta a la Columnata y la antesala del Despacho Oval.
- **Despacho Oval:** un óvalo de verdad (`Cuarto.elipse`, 10,4 x 8,2 m por dentro del muro). Escritorio
  Resolute (1,83 x 1,22 m) frente a las ventanas del sur con dos banderas, chimenea al norte, dos sofás.
  Puertas: a la antesala (oeste) y al Jardín de las Rosas (este). El muro del Ala que cruzaba el óvalo se
  abrió hasta el techo del óvalo (desde afuera no cambia nada); su muro por dentro es un macizo con
  huecos en las dos puertas y las tres ventanas del sur.
- **Sótano (y −3,4):** Sala de Crisis (mesa de conferencias, pantallas, puestos de vigilancia frente al muro
  de video) y Comedor de la Marina, por una escalera en U. Lo no excavado es macizo. Con el sótano abierto,
  el suelo se recorta dentro de la huella del Ala (planos con `clipIntersection`); con la planta principal,
  solo sobre el pozo de la escalera, para que se vea bajar.
- **Edificio Eisenhower (Planta baja y 1,2, arriba de su escalinata; Segundo piso y 5,4):** dos patios con un
  anillo de pasillos de damero, oficinas alrededor y un ala central. El lugar `eeob` es la Oficina Ceremonial
  del Vicepresidente, en el segundo piso (se sube por la escalera junto al vestíbulo).
- **Tesoro (y 0):** entrada en el pabellón norte (puerta nueva entre dos ventanas, z −55), dos patios, anillo
  de pasillos y, al centro, la Sala del Efectivo (lugar `tesoro`).
- **Fachadas macizas** (Eisenhower y Tesoro no tienen cara de adentro): un muro de forro ocupa el espesor
  del muro real salvo 2 cm de afuera. El remate es por planta (`CLAVE_REMATE`).
- **Puertas a la calle de estos edificios:** `ENLACES` con `puerta`: un nodo a cada lado del vano, se cambia
  de planta justo en él. «Cómo llegar» nombra también las escaleras que bajan («al Sótano»).
- **Cámara:** las salas del Ala Oeste se miran desde el sureste (al sur del Despacho hay árboles).
- **Medido (calidad media):** Principal del Ala 5 mallas / 27.615 triángulos; Sótano 5 / 7.558; Eisenhower
  baja 5 / 57.334, segundo 6 / 58.810; Tesoro 5 / 53.212. En el teléfono (390x844), la superficie al cargar:
  286 llamadas y 6.241.725 triángulos (paso B: 286 y 6.241.541); igual después de construir las cinco plantas.
- **Prueba:** la simulación recorre todas las salas desde las tres puertas de la Residencia sin tramos ocultos,
  por puertas, a menos de 5 m/s, y verifica que las nueve plantas se pisan, que ningún lugar sigue siendo
  «el edificio entero» y que no queda ningún tramo oculto en el grafo fuera del ascensor.

## Estado tras la revisión (arreglos)

- **«Salir» mientras se sigue a alguien adentro:** `mostrarPlanta` pasa la cámara a «dron» antes de cambiar
  de planta (lo que pide la persona gana sobre «seguir», que volvía a abrir la planta del seguido).
- **De noche, adentro, los residentes ya no son siluetas:** sin luces nuevas, con una planta abierta la
  hemisférica que ya existe se vuelve cálida y sube con la noche (`rellenoInterior` en `motor.ts`). El sótano
  del Ala Oeste no tiene ventanas: relleno, charcos y brillo de lámparas y pantallas fijos las 24 h.
- **Cámara de seguir adentro:** si el muro cortado tapa el torso, gira de a 30° hacia el cuarto (cada 0,25 s,
  sin tirar hacia atrás durante 2 s); el rayo tiene que pasar la altura del corte dentro del cuarto.
- **Despacho Oval:** se encuadra desde el norte (escritorio de frente, ventanas detrás, sin árboles).
- **Sala del Efectivo:** sin columnas sueltas; balcón de bronce corrido sobre ménsulas (mueble `balcon`, va en
  alto y no es sólido) y diez ventanillas a lo largo de los muros largos.
- **Habitaciones:** `plantaDeLugar` lleva al Tercer piso. La barra de plantas cambia en el acto al entrar desde
  el mapa, y el subtítulo dice el edificio y la planta («Ala Oeste · Sótano») en vez de «Jardines y edificios».
- **Desmontar:** `Interiores.dispose()` devuelve los materiales originales y libera los clones con corte.
