'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../config/db');
const { validarVeterinario, escapeRegex } = require('../utils/validacion');

const router = express.Router();
const urlCon = (url, clave, mensaje) => `${url}?${clave}=${encodeURIComponent(mensaje)}`;

function valoresDelFormulario(veterinario) {
  return {
    nombre: veterinario?.nombre || '',
    especialidad: veterinario?.especialidad || 'General',
    licencia: veterinario?.licencia || '',
    telefono: veterinario?.telefono || '',
    consultorio: veterinario?.consultorio || '',
    activo: veterinario?.activo !== false
  };
}

router.get('/', async (req, res) => {
  const db = getDb();
  const q = String(req.query.q || '').trim();
  const activo = String(req.query.activo || '').trim();
  const condiciones = [];

  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    condiciones.push({ nombre: rx }, { especialidad: rx }, { licencia: rx });
  }
  if (activo === 'true') condiciones.push({ activo: true });
  if (activo === 'false') condiciones.push({ activo: false });

  const filtro = condiciones.length ? { $and: condiciones } : {};
  const [veterinarios, cargas] = await Promise.all([
    db.collection('veterinarios').find(filtro).sort({ nombre: 1 }).toArray(),
    db.collection('citas').aggregate([
      { $group: { _id: '$veterinarioId', total: { $sum: 1 } } }
    ]).toArray()
  ]);

  const totales = new Map(cargas.map((item) => [item._id.toString(), item.total]));
  res.render('veterinarios/list', { veterinarios, q, activo, totales });
});

router.get('/nuevo', (req, res) => {
  res.render('veterinarios/form', {
    modo: 'nuevo', veterinario: null, valores: valoresDelFormulario(null), errores: []
  });
});

router.post('/', async (req, res, next) => {
  const { values, errores } = validarVeterinario(req.body);
  if (errores.length) {
    return res.status(400).render('veterinarios/form', {
      modo: 'nuevo', veterinario: null, valores: values, errores
    });
  }

  try {
    await getDb().collection('veterinarios').insertOne({ ...values, createdAt: new Date() });
    res.redirect(urlCon('/veterinarios', 'mensaje', 'Veterinario registrado correctamente.'));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).render('veterinarios/form', {
        modo: 'nuevo',
        veterinario: null,
        valores: values,
        errores: ['La licencia ya está registrada.']
      });
    }
    next(error);
  }
});

router.get('/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de veterinario no válido.' });

  const db = getDb();
  const veterinario = await db.collection('veterinarios').findOne({ _id: oid });
  if (!veterinario) return res.status(404).render('error', { mensaje: 'No se encontró el veterinario solicitado.' });

  const [resumen, recientes] = await Promise.all([
    db.collection('citas').aggregate([
      { $match: { veterinarioId: oid } },
      {
        $group: {
          _id: '$estado',
          total: { $sum: 1 },
          ingresos: { $sum: '$costo' }
        }
      },
      { $sort: { total: -1 } }
    ]).toArray(),
    db.collection('citas').aggregate([
      { $match: { veterinarioId: oid } },
      {
        $lookup: {
          from: 'pacientes',
          localField: 'pacienteId',
          foreignField: '_id',
          as: 'paciente'
        }
      },
      { $set: { paciente: { $arrayElemAt: ['$paciente', 0] } } },
      { $sort: { fecha: -1 } },
      { $limit: 8 },
      { $project: { fecha: 1, motivo: 1, estado: 1, pacienteNombre: '$paciente.nombre' } }
    ]).toArray()
  ]);

  res.render('veterinarios/detail', { veterinario, resumen, recientes });
});

router.get('/:id/editar', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de veterinario no válido.' });

  const veterinario = await getDb().collection('veterinarios').findOne({ _id: oid });
  if (!veterinario) return res.status(404).render('error', { mensaje: 'No se encontró el veterinario solicitado.' });

  res.render('veterinarios/form', {
    modo: 'editar', veterinario, valores: valoresDelFormulario(veterinario), errores: []
  });
});

router.post('/:id/actualizar', async (req, res, next) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de veterinario no válido.' });

  const { values, errores } = validarVeterinario(req.body);
  if (errores.length) {
    return res.status(400).render('veterinarios/form', {
      modo: 'editar', veterinario: { _id: oid }, valores: values, errores
    });
  }

  try {
    await getDb().collection('veterinarios').updateOne({ _id: oid }, { $set: values });
    res.redirect(urlCon(`/veterinarios/${oid}`, 'mensaje', 'Veterinario actualizado correctamente.'));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).render('veterinarios/form', {
        modo: 'editar',
        veterinario: { _id: oid },
        valores: values,
        errores: ['La licencia ya está registrada.']
      });
    }
    next(error);
  }
});

router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.redirect(urlCon('/veterinarios', 'error', 'Identificador no válido.'));

    const db = getDb();
    const dependientes = await db.collection('citas').countDocuments({ veterinarioId: oid });
    if (dependientes > 0) {
      return res.redirect(urlCon(
        `/veterinarios/${oid}`,
        'error',
        `No se puede eliminar: el veterinario tiene ${dependientes} cita(s) asociada(s).`
      ));
    }

    const resultado = await db.collection('veterinarios').deleteOne({ _id: oid });
    if (resultado.deletedCount === 0) {
      return res.redirect(urlCon('/veterinarios', 'error', 'El veterinario ya no existe.'));
    }
    res.redirect(urlCon('/veterinarios', 'mensaje', 'Veterinario eliminado correctamente.'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
