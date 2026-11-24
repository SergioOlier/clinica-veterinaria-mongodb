'use strict';

const path = require('path');
const express = require('express');
require('dotenv').config();

const { connectDB, getDb, closeDB } = require('./config/db');
const { setupDatabase } = require('./config/schema');
const format = require('./utils/format');
const { ESPECIES, ESTADOS, ESPECIALIDADES } = require('./utils/validacion');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.locals.formatearFecha = format.formatearFecha;
app.locals.formatearMoneda = format.formatearMoneda;
app.locals.formatearCelda = format.formatearCelda;
app.locals.ESPECIES = ESPECIES;
app.locals.ESTADOS = ESTADOS;
app.locals.ESPECIALIDADES = ESPECIALIDADES;

app.use((req, res, next) => {
  res.locals.mensaje = req.query.mensaje || null;
  res.locals.error = req.query.error || null;
  res.locals.ruta = req.path;
  res.locals.activoMenu = (prefijo) => (req.path === prefijo || req.path.startsWith(`${prefijo}/`) ? 'active' : '');
  next();
});

app.use('/', require('./routes/index'));
app.use('/tutores', require('./routes/tutores'));
app.use('/pacientes', require('./routes/pacientes'));
app.use('/veterinarios', require('./routes/veterinarios'));
app.use('/citas', require('./routes/citas'));
app.use('/reportes', require('./routes/reportes'));

app.use((req, res) => {
  res.status(404).render('error', { mensaje: 'La página solicitada no existe.' });
});

app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[ERROR]', error);
  if (res.headersSent) return next(error);
  res.status(error.status || 500).render('error', {
    mensaje: error.message || 'Ocurrió un error inesperado.',
    detalle: process.env.NODE_ENV === 'development' ? error.stack : null
  });
});

async function start() {
  const db = await connectDB();
  await setupDatabase(db);
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => {
    console.log(`Clínica Veterinaria listo en http://localhost:${port}`);
    console.log(`Base de datos: ${process.env.DB_NAME || 'clinica_veterinaria'}`);
  });

  const cerrar = () => {
    server.close(async () => {
      await closeDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error('No se pudo iniciar la aplicación:', error.message);
    process.exit(1);
  });
}

module.exports = { app, start };
