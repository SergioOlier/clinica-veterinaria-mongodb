# 🐾 Huellas · Clínica Veterinaria (MongoDB)

Aplicación web de una clínica veterinaria construida con **Node.js + Express + EJS + MongoDB**.
Implementa CRUD completo, validación en aplicación y `$jsonSchema`, integridad de referencias,
índices, 1820 documentos iniciales y 4 consultas de agregación con `$match`, `$group`, `$sort` y `$lookup`.

---

## 1. Requisitos

- Node.js 20 o superior.
- MongoDB local o un cluster de MongoDB Atlas.
- npm.

---

## 2. Instalación

```bash
npm install
cp .env.example .env   # en Windows: copy .env.example .env
```

Edita `.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
DB_NAME=clinica_veterinaria
PORT=3000
```

Para **MongoDB Atlas** usa una cadena similar (reemplaza usuario, clave y cluster):

```env
MONGODB_URI=mongodb+srv://USUARIO:CLAVE@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

> La contraseña va en `.env`, nunca en el código. `.env` está excluido por `.gitignore`.
> En Atlas recuerda agregar tu IP al *Network Access*.

---

## 3. Comandos

| Comando | Qué hace |
|---|---|
| `npm run setup` | Crea colecciones con `$jsonSchema` y los índices. |
| `npm run seed` | Carga 120 tutores + 260 pacientes + 40 veterinarios + 1400 citas = **1820 documentos**. |
| `npm start` | Inicia el servidor en `http://localhost:3000`. |
| `npm run dev` | Igual que `start`, pero recarga al guardar. |
| `npm run verify` | Muestra conteos y ejecuta los 4 reportes por consola. |

Orden recomendado la primera vez:

```bash
npm install
npm run setup
npm run seed
npm run verify
npm start
```

> `npm run seed` limpia las colecciones antes de insertar. Para conservar datos: `SEED_LIMPIAR=false npm run seed`.

---

## 4. Rutas principales

| Ruta | Descripción |
|---|---|
| `/` | Panel con totales, últimas citas y distribución por estado. |
| `/tutores` | CRUD de tutores (dirección embebida). |
| `/pacientes` | CRUD de pacientes; alta/baja de vacunas y alergias (`$push`, `$pull`, `$addToSet`). |
| `/veterinarios` | CRUD de veterinarios. |
| `/citas` | CRUD de citas; signos vitales embebidos y servicios como array. |
| `/reportes` | 4 agregaciones con pipeline, ejemplo, resultado real e interpretación. |

---

## 5. Modelo de datos resumido

```
tutores ──< pacientes ──< citas >── veterinarios
   │                         │
   └─ dirección (embebido)   ├─ signosVitales (embebido)
                             └─ servicios[] (array)
pacientes: vacunas[] (array de subdocumentos), alergias[] (array)
```

- **Embeber:** dirección del tutor y signos vitales de la cita, porque se leen y actualizan con su documento padre.
- **Referenciar (`ObjectId`):** `pacientes.tutorId`, `citas.pacienteId`, `citas.veterinarioId`, porque son entidades con vida propia y crecen sin límite.
- **Arrays:** `vacunas`, `alergias` y `servicios`.

Diagrama completo: [`informe/diagrama_modelo.mmd`](informe/diagrama_modelo.mmd).

---

## 6. Reportes (agregaciones)

1. **Citas completadas por veterinario** — `$match`, `$lookup`, `$unwind`, `$group`, `$project`, `$sort`.
2. **Gasto promedio por especie** — `$match`, `$lookup`, `$unwind`, `$group`, `$sort`.
3. **Top 5 de pacientes con más servicios** — `$addFields`, `$lookup`, `$group`, `$sort`, `$limit`.
4. **Evolución mensual de citas** — `$match` por rango, `$group` con `$dateToString`, `$sort`.

Documentación detallada: [`informe/informe_tecnico.md`](informe/informe_tecnico.md).
Guía de ejecución y sustentación: [`GUIA_EJECUCION_Y_SUSTENTACION.docx`](GUIA_EJECUCION_Y_SUSTENTACION.docx).

---

## 7. Validación e índices

- Validación de formularios en `src/utils/validacion.js`.
- Validación de esquema MongoDB (`$jsonSchema`) en `src/config/schema.js`.
- Eliminación protegida: no se borra un tutor/paciente/veterinario si tiene dependencias.
- Índices: `ux_tutores_documento`, `ux_veterinarios_licencia`, `ix_pacientes_tutorId`,
  `ix_citas_pacienteId`, `ix_citas_veterinarioId`, `ix_citas_estado_fecha`, entre otros.
  Los campos foráneos indexados mejoran los `$lookup`.

---

## 8. Estructura

```
src/
├─ app.js
├─ config/        db.js, schema.js
├─ routes/        index, tutores, pacientes, veterinarios, citas, reportes
├─ services/      catalogos.js, reportes.js
├─ utils/         validacion.js, format.js
├─ views/         plantillas EJS
└─ public/        styles.css
scripts/
├─ seed-data.js   generador determinista
├─ seed.js        carga inicial
├─ setup-db.js    validaciones + índices
└─ verificar.js   comprobación rápida
informe/
├─ informe_tecnico.md
└─ diagrama_modelo.mmd
```

---


