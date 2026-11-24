'use strict';

require('dotenv').config();
const { connectDB, getDb, closeDB } = require('../src/config/db');
const { setupDatabase } = require('../src/config/schema');

async function main() {
  const db = await connectDB();
  const resultado = await setupDatabase(db);
  console.log('Validaciones aplicadas:', resultado.validators.join(', '));
  console.log('Índices asegurados en:', resultado.indexes.join(', '));

  for (const nombre of ['tutores', 'pacientes', 'veterinarios', 'citas']) {
    console.log(`  ${nombre}: ${await db.collection(nombre).countDocuments()} documento(s)`);
  }
}

main()
  .catch((error) => {
    console.error('Error al configurar la base de datos:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closeDB());
