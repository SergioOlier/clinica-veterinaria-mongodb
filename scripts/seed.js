'use strict';

require('dotenv').config();
const { connectDB, getDb, closeDB } = require('../src/config/db');
const { setupDatabase } = require('../src/config/schema');
const { generarDatos } = require('./seed-data');

async function main() {
  const db = await connectDB();
  await setupDatabase(db);

  const datos = generarDatos({
    tutores: Number(process.env.SEED_TUTORES || 120),
    pacientes: Number(process.env.SEED_PACIENTES || 260),
    veterinarios: Number(process.env.SEED_VETERINARIOS || 40),
    citas: Number(process.env.SEED_CITAS || 1400)
  });

  const colecciones = ['citas', 'pacientes', 'veterinarios', 'tutores'];
  if (process.env.SEED_LIMPIAR !== 'false') {
    console.log('Limpiando colecciones (use SEED_LIMPIAR=false para conservar datos)...');
    await Promise.all(colecciones.map((nombre) => db.collection(nombre).deleteMany({})));
  }

  console.log('Insertando datos de ejemplo...');
  await db.collection('tutores').insertMany(datos.tutores, { ordered: false });
  await db.collection('veterinarios').insertMany(datos.veterinarios, { ordered: false });
  await db.collection('pacientes').insertMany(datos.pacientes, { ordered: false });
  await db.collection('citas').insertMany(datos.citas, { ordered: false });

  const total = datos.tutores.length + datos.pacientes.length + datos.veterinarios.length + datos.citas.length;
  console.log('\nSemilla cargada correctamente:');
  console.log(`  tutores:     ${datos.tutores.length}`);
  console.log(`  pacientes:   ${datos.pacientes.length}`);
  console.log(`  veterinarios:${datos.veterinarios.length}`);
  console.log(`  citas:       ${datos.citas.length}`);
  console.log(`  TOTAL:       ${total} documentos (mínimo requerido: 1000)`);
  console.log(`  Fecha de referencia de la semilla: ${datos.fechaReferencia.toISOString()}`);
}

main()
  .catch((error) => {
    console.error('Error al cargar la semilla:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closeDB());
