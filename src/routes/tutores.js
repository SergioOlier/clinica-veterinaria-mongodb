'use strict';

const express = require('express');
const { getDb, toObjectId } = require('../config/db');
const { validarTutor, escapeRegex } = require('../utils/validacion');

const router = express.Router();
const urlCon = (url, clave, mensaje) => `${url}?${clave}=${encodeURIComponent(mensaje)}`;

function valoresDelFormulario(tutor) {
  return {
    nombre: tutor?.nombre || '',
    apellido: tutor?.apellido || '',
    documento: tutor?.documento || '',
    telefono: tutor?.telefono || '',
    email: tutor?.email || '',
    direccion: {
      calle: tutor?.direccion?.calle || '',
      ciudad: tutor?.direccion?.ciudad || '',
      codigoPostal: tutor?.direccion?.codigoPostal || ''
    }
  };
}

router.get('/', async (req, res) => {
  const db = getDb();
  const q = String(req.query.q || '').trim();
  const filtro = q
    ? {
        $or: [
          { nombre: { $regex: escapeRegex(q), $options: 'i' } },
          { apellido: { $regex: escapeRegex(q), $options: 'i' } },
          { documento: { $regex: escapeRegex(q), $options: 'i' } },
          { email: { $regex: escapeRegex(q), $options: 'i' } },
          { 'direccion.ciudad': { $regex: escapeRegex(q), $options: 'i' } }
        ]
      }
    : {};

  const [tutores, conteoPacientes] = await Promise.all([
    db.collection('tutores').find(filtro).sort({ nombre: 1 }).limit(300).toArray(),
    db.collection('pacientes').aggregate([
      { $group: { _id: '$tutorId', total: { $sum: 1 } } }
    ]).toArray()
  ]);

  const totales = new Map(conteoPacientes.map((item) => [item._id.toString(), item.total]));
  res.render('tutores/list', { tutores, q, totales });
});

router.get('/nuevo', (req, res) => {
  res.render('tutores/form', {
    modo: 'nuevo',
    tutor: null,
    valores: valoresDelFormulario(null),
    errores: []
  });
});

router.post('/', async (req, res, next) => {
  const { values, errores } = validarTutor(req.body);
  if (errores.length) {
    return res.status(400).render('tutores/form', {
      modo: 'nuevo', tutor: null, valores: values, errores
    });
  }

  try {
    await getDb().collection('tutores').insertOne({ ...values, createdAt: new Date() });
    res.redirect(urlCon('/tutores', 'mensaje', 'Tutor registrado correctamente.'));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).render('tutores/form', {
        modo: 'nuevo',
        tutor: null,
        valores: values,
        errores: ['El documento o correo ya está registrado.']
      });
    }
    next(error);
  }
});

router.get('/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de tutor no válido.' });

  const db = getDb();
  const tutor = await db.collection('tutores').findOne({ _id: oid });
  if (!tutor) return res.status(404).render('error', { mensaje: 'No se encontró el tutor solicitado.' });

  const pacientes = await db.collection('pacientes').find({ tutorId: oid }).sort({ nombre: 1 }).toArray();
  const totalCitas = await db.collection('citas').countDocuments({ pacienteId: { $in: pacientes.map((p) => p._id) } });

  res.render('tutores/detail', { tutor, pacientes, totalCitas });
});

router.get('/:id/editar', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de tutor no válido.' });

  const tutor = await getDb().collection('tutores').findOne({ _id: oid });
  if (!tutor) return res.status(404).render('error', { mensaje: 'No se encontró el tutor solicitado.' });

  res.render('tutores/form', {
    modo: 'editar',
    tutor,
    valores: valoresDelFormulario(tutor),
    errores: []
  });
});

router.post('/:id/actualizar', async (req, res, next) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de tutor no válido.' });

  const { values, errores } = validarTutor(req.body);
  if (errores.length) {
    return res.status(400).render('tutores/form', {
      modo: 'editar',
      tutor: { _id: oid },
      valores: values,
      errores
    });
  }

  try {
    await getDb().collection('tutores').updateOne({ _id: oid }, { $set: values });
    res.redirect(urlCon(`/tutores/${oid}`, 'mensaje', 'Tutor actualizado correctamente.'));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).render('tutores/form', {
        modo: 'editar',
        tutor: { _id: oid },
        valores: values,
        errores: ['El documento o correo ya está registrado.']
      });
    }
    next(error);
  }
});

router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.redirect(urlCon('/tutores', 'error', 'Identificador no válido.'));

    const db = getDb();
    const dependientes = await db.collection('pacientes').countDocuments({ tutorId: oid });
    if (dependientes > 0) {
      return res.redirect(urlCon(
        `/tutores/${oid}`,
        'error',
        `No se puede eliminar: el tutor tiene ${dependientes} paciente(s) asociado(s).`
      ));
    }

    const resultado = await db.collection('tutores').deleteOne({ _id: oid });
    if (resultado.deletedCount === 0) {
      return res.redirect(urlCon('/tutores', 'error', 'El tutor ya no existe.'));
    }
    res.redirect(urlCon('/tutores', 'mensaje', 'Tutor eliminado correctamente.'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
