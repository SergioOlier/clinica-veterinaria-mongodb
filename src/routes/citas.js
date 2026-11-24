'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../config/db');
const { pacientesParaSelect, veterinariosParaSelect } = require('../services/catalogos');
const {
  validarCita,
  validarServicio,
  texto,
  escapeRegex,
  fechaDesdeForm,
  ESTADOS
} = require('../utils/validacion');
const { paraInputDateTime } = require('../utils/format');

const router = express.Router();
const urlCon = (url, clave, mensaje) => `${url}?${clave}=${encodeURIComponent(mensaje)}`;

function valoresDelFormulario(cita) {
  return {
    pacienteIdTexto: cita?.pacienteId?.toString() || '',
    veterinarioIdTexto: cita?.veterinarioId?.toString() || '',
    fecha: paraInputDateTime(cita?.fecha) || paraInputDateTime(new Date()),
    motivo: cita?.motivo || '',
    estado: cita?.estado || 'Programada',
    duracionMin: cita?.duracionMin || 30,
    costo: cita?.costo || 50000,
    temperatura: cita?.signosVitales?.temperatura || 38.3,
    frecuenciaCardiaca: cita?.signosVitales?.frecuenciaCardiaca || 100,
    pesoVital: cita?.signosVitales?.peso || 1,
    servicios: cita?.servicios?.join(', ') || '',
    observaciones: cita?.observaciones || ''
  };
}

async function awaitCatalogos(db) {
  const [pacientes, veterinarios] = await Promise.all([
    pacientesParaSelect(db),
    veterinariosParaSelect(db)
  ]);
  return { pacientes, veterinarios };
}

async function referenciasValidas(db, values, errores) {
  if (values.pacienteId && !await db.collection('pacientes').findOne({ _id: values.pacienteId }, { projection: { _id: 1 } })) {
    errores.push('El paciente seleccionado no existe.');
  }
  if (values.veterinarioId && !await db.collection('veterinarios').findOne({ _id: values.veterinarioId }, { projection: { _id: 1 } })) {
    errores.push('El veterinario seleccionado no existe.');
  }
}

router.get('/', async (req, res) => {
  const db = getDb();
  const q = String(req.query.q || '').trim();
  const estado = String(req.query.estado || '').trim();
  const desde = fechaDesdeForm(req.query.desde);
  const hasta = fechaDesdeForm(req.query.hasta);
  const condiciones = [];

  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    condiciones.push({ motivo: rx }, { 'paciente.nombre': rx }, { 'veterinario.nombre': rx });
  }
  if (estado) condiciones.push({ estado });
  if (desde) condiciones.push({ fecha: { $gte: desde } });
  if (hasta) condiciones.push({ fecha: { $lte: new Date(hasta.getTime() + 24 * 60 * 60 * 1000 - 1) } });

  const pipeline = [
    {
      $lookup: {
        from: 'pacientes',
        localField: 'pacienteId',
        foreignField: '_id',
        as: 'paciente'
      }
    },
    {
      $lookup: {
        from: 'veterinarios',
        localField: 'veterinarioId',
        foreignField: '_id',
        as: 'veterinario'
      }
    },
    {
      $set: {
        paciente: { $arrayElemAt: ['$paciente', 0] },
        veterinario: { $arrayElemAt: ['$veterinario', 0] }
      }
    }
  ];
  if (condiciones.length) pipeline.push({ $match: { $and: condiciones } });
  pipeline.push(
    { $sort: { fecha: -1 } },
    { $limit: 300 },
    {
      $project: {
        fecha: 1,
        motivo: 1,
        estado: 1,
        costo: 1,
        pacienteNombre: '$paciente.nombre',
        pacienteEspecie: '$paciente.especie',
        veterinarioNombre: '$veterinario.nombre'
      }
    }
  );

  const citas = await db.collection('citas').aggregate(pipeline).toArray();
  res.render('citas/list', {
    citas,
    q,
    estado,
    desde: String(req.query.desde || ''),
    hasta: String(req.query.hasta || ''),
    estados: ESTADOS
  });
});

router.get('/nueva', async (req, res) => {
  const db = getDb();
  res.render('citas/form', {
    modo: 'nueva',
    cita: null,
    valores: valoresDelFormulario(null),
    estados: ESTADOS,
    ...await awaitCatalogos(db),
    errores: []
  });
});

router.post('/', async (req, res, next) => {
  const db = getDb();
  const { values, errores } = validarCita(req.body);
  await referenciasValidas(db, values, errores);

  if (errores.length) {
    return res.status(400).render('citas/form', {
      modo: 'nueva',
      cita: null,
      valores: values,
      estados: ESTADOS,
      ...await awaitCatalogos(db),
      errores
    });
  }

  try {
    await db.collection('citas').insertOne({
      pacienteId: values.pacienteId,
      veterinarioId: values.veterinarioId,
      fecha: values.fecha,
      motivo: values.motivo,
      estado: values.estado,
      duracionMin: values.duracionMin,
      costo: values.costo,
      signosVitales: values.signosVitales,
      servicios: values.servicios,
      observaciones: values.observaciones,
      createdAt: new Date()
    });
    res.redirect(urlCon('/citas', 'mensaje', 'Cita registrada correctamente.'));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de cita no válido.' });

  const db = getDb();
  const cita = await db.collection('citas').findOne({ _id: oid });
  if (!cita) return res.status(404).render('error', { mensaje: 'No se encontró la cita solicitada.' });

  const [paciente, veterinario] = await Promise.all([
    db.collection('pacientes').findOne({ _id: cita.pacienteId }),
    db.collection('veterinarios').findOne({ _id: cita.veterinarioId })
  ]);
  const tutor = paciente
    ? await db.collection('tutores').findOne({ _id: paciente.tutorId })
    : null;

  res.render('citas/detail', { cita, paciente, tutor, veterinario });
});

router.get('/:id/editar', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de cita no válido.' });

  const db = getDb();
  const cita = await db.collection('citas').findOne({ _id: oid });
  if (!cita) return res.status(404).render('error', { mensaje: 'No se encontró la cita solicitada.' });

  res.render('citas/form', {
    modo: 'editar',
    cita,
    valores: valoresDelFormulario(cita),
    estados: ESTADOS,
    ...await awaitCatalogos(db),
    errores: []
  });
});

router.post('/:id/actualizar', async (req, res, next) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de cita no válido.' });

  const db = getDb();
  const { values, errores } = validarCita(req.body);
  await referenciasValidas(db, values, errores);

  if (errores.length) {
    return res.status(400).render('citas/form', {
      modo: 'editar',
      cita: { _id: oid },
      valores: values,
      estados: ESTADOS,
      ...await awaitCatalogos(db),
      errores
    });
  }

  try {
    await db.collection('citas').updateOne({ _id: oid }, {
      $set: {
        pacienteId: values.pacienteId,
        veterinarioId: values.veterinarioId,
        fecha: values.fecha,
        motivo: values.motivo,
        estado: values.estado,
        duracionMin: values.duracionMin,
        costo: values.costo,
        signosVitales: values.signosVitales,
        servicios: values.servicios,
        observaciones: values.observaciones
      }
    });
    res.redirect(urlCon(`/citas/${oid}`, 'mensaje', 'Cita actualizada con $set (incluye signos vitales).'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/servicios', async (req, res, next) => {
  const oid = toObjectId(req.params.id);
  const { values, errores } = validarServicio(req.body);
  if (!oid || errores.length) {
    return res.redirect(urlCon('/citas', 'error', errores.join(' ') || 'Identificador no válido.'));
  }

  try {
    await getDb().collection('citas').updateOne({ _id: oid }, {
      $push: { servicios: values.nombre }
    });
    res.redirect(urlCon(`/citas/${oid}`, 'mensaje', 'Servicio agregado con $push.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/servicios/eliminar', async (req, res, next) => {
  const oid = toObjectId(req.params.id);
  const servicio = texto(req.body.servicio);
  if (!oid || !servicio) {
    return res.redirect(urlCon('/citas', 'error', 'Datos no válidos.'));
  }

  try {
    await getDb().collection('citas').updateOne({ _id: oid }, {
      $pull: { servicios: servicio }
    });
    res.redirect(urlCon(`/citas/${oid}`, 'mensaje', 'Servicio eliminado con $pull.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.redirect(urlCon('/citas', 'error', 'Identificador no válido.'));

    const resultado = await getDb().collection('citas').deleteOne({ _id: oid });
    if (resultado.deletedCount === 0) {
      return res.redirect(urlCon('/citas', 'error', 'La cita ya no existe.'));
    }
    res.redirect(urlCon('/citas', 'mensaje', 'Cita eliminada correctamente.'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
