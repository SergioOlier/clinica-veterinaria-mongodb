'use strict';

require('dotenv').config();
const { connectDB, getDb, closeDB } = require('../src/config/db');
const { ejecutarReportes } = require('../src/services/reportes');

async function main() {
  const db = await connectDB();
  const nombres = ['tutores', 'pacientes', 'veterinarios', 'citas'];
  const conteos = {};
  for (const nombre of nombres) conteos[nombre] = await db.collection(nombre).countDocuments();

  const total = Object.values(conteos).reduce((a, b) => a + b, 0);
  console.log('Conteo de documentos:', conteos);
  console.log(`TOTAL: ${total} ${total >= 1000 ? '✓ cumple el mínimo de 1000' : '✗ NO cumple el mínimo de 1000'}`);

  const reportes = await ejecutarReportes(db);
  for (const reporte of reportes) {
    console.log(`\n=== ${reporte.titulo} (${reporte.datos.length} filas) ===`);
    console.log(reporte.pregunta);
    console.table(reporte.datos.slice(0, 3));
  }
}

main()
  .catch((error) => {
    console.error('Error al verificar:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closeDB());
