'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb, toObjectId } = require('../config/db');
const { tutoresParaSelect } = require('../services/catalogos');
const {
  validarPaciente,
  validarVacuna,
  texto,
  escapeRegex
} = require('../utils/validacion');

const router = express.Router();
const urlCon = (url, clave, mensaje) => `${url}?${clave}=${encodeURIComponent(mensaje)}`;

function valoresDelFormulario(paciente) {
  return {
    nombre: paciente?.nombre || '',
    especie: paciente?.especie || 'Perro',
    raza: paciente?.raza || '',
    sexo: paciente?.sexo || 'Macho',
    fechaNacimiento: paciente?.fechaNacimiento?.toISOString().slice(0, 10) || '',
    peso: paciente?.peso || '',
    tutorIdTexto: paciente?.tutorId?.toString() || '',
    alergias: paciente?.alergias?.join(', ') || ''
  };
}

async function tutorExiste(db, id) {
  return Boolean(id && await db.collection('tutores').findOne({ _id: id }, { projection: { _id: 1 } }));
}

router.get('/', async (req, res) => {
  const db = getDb();
  const q = String(req.query.q || '').trim();
  const especie = String(req.query.especie || '').trim();
  const condiciones = [];

  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    condiciones.push({ nombre: rx }, { raza: rx }, { 'tutor.nombre': rx }, { 'tutor.apellido': rx });
  }
  if (especie) condiciones.push({ especie });

  const pipeline = [
    {
      $lookup: {
        from: 'tutores',
        localField: 'tutorId',
        foreignField: '_id',
        as: 'tutor'
      }
    },
    { $set: { tutor: { $arrayElemAt: ['$tutor', 0] } } },
    {
      $lookup: {
        from: 'citas',
        localField: '_id',
        foreignField: 'pacienteId',
        as: 'citas'
      }
    },
    { $set: { totalCitas: { $size: '$citas' } } }
  ];
  if (condiciones.length) pipeline.push({ $match: { $and: condiciones } });
  pipeline.push(
    { $sort: { nombre: 1 } },
    { $limit: 300 },
    { $project: { citas: 0, 'tutor.direccion': 0, 'tutor.email': 0 } }
  );

  const pacientes = await db.collection('pacientes').aggregate(pipeline).toArray();
  res.render('pacientes/list', { pacientes, q, especie });
});

router.get('/nuevo', async (req, res) => {
  res.render('pacientes/form', {
    modo: 'nuevo',
    paciente: null,
    valores: valoresDelFormulario(null),
    tutores: await tutoresParaSelect(getDb()),
    errores: []
  });
});

router.post('/', async (req, res, next) => {
  const db = getDb();
  const { values, errores } = validarPaciente(req.body);

  const tieneVacuna = Boolean(texto(req.body.vacunaNombre) || texto(req.body.vacunaFecha));
  let vacuna = null;
  if (tieneVacuna) {
    const resultado = validarVacuna({
      nombre: req.body.vacunaNombre,
      fecha: req.body.vacunaFecha,
      proximaDosis: req.body.vacunaProxima
    });
    vacuna = resultado.values;
    errores.push(...resultado.errores.map((e) => `Vacuna: ${e}`));
  }

  if (values.tutorId && !await tutorExiste(db, values.tutorId)) {
    errores.push('El tutor seleccionado no existe.');
  }

  if (errores.length) {
    return res.status(400).render('pacientes/form', {
      modo: 'nuevo',
      paciente: null,
      valores: values,
      tutores: await tutoresParaSelect(db),
      errores
    });
  }

  try {
    await db.collection('pacientes').insertOne({
      nombre: values.nombre,
      especie: values.especie,
      raza: values.raza,
      sexo: values.sexo,
      fechaNacimiento: values.fechaNacimiento,
      peso: values.peso,
      tutorId: values.tutorId,
      vacunas: vacuna ? [{ _id: new ObjectId(), ...vacuna }] : [],
      alergias: values.alergias,
      createdAt: new Date()
    });
    res.redirect(urlCon('/pacientes', 'mensaje', 'Paciente registrado correctamente.'));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de paciente no válido.' });

  const db = getDb();
  const paciente = await db.collection('pacientes').findOne({ _id: oid });
  if (!paciente) return res.status(404).render('error', { mensaje: 'No se encontró el paciente solicitado.' });

  const [tutor, citas] = await Promise.all([
    db.collection('tutores').findOne({ _id: paciente.tutorId }),
    db.collection('citas').aggregate([
      { $match: { pacienteId: oid } },
      {
        $lookup: {
          from: 'veterinarios',
          localField: 'veterinarioId',
          foreignField: '_id',
          as: 'veterinario'
        }
      },
      { $set: { veterinario: { $arrayElemAt: ['$veterinario', 0] } } },
      { $sort: { fecha: -1 } },
      { $project: { veterinario: 1, fecha: 1, motivo: 1, estado: 1, costo: 1 } }
    ]).toArray()
  ]);

  res.render('pacientes/detail', { paciente, tutor, citas });
});

router.get('/:id/editar', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de paciente no válido.' });

  const db = getDb();
  const paciente = await db.collection('pacientes').findOne({ _id: oid });
  if (!paciente) return res.status(404).render('error', { mensaje: 'No se encontró el paciente solicitado.' });

  res.render('pacientes/form', {
    modo: 'editar',
    paciente,
    valores: valoresDelFormulario(paciente),
    tutores: await tutoresParaSelect(db),
    errores: []
  });
});

router.post('/:id/actualizar', async (req, res, next) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).render('error', { mensaje: 'Identificador de paciente no válido.' });

  const db = getDb();
  const { values, errores } = validarPaciente(req.body);
  if (values.tutorId && !await tutorExiste(db, values.tutorId)) {
    errores.push('El tutor seleccionado no existe.');
  }
  if (errores.length) {
    return res.status(400).render('pacientes/form', {
      modo: 'editar',
      paciente: { _id: oid },
      valores: values,
      tutores: await tutoresParaSelect(db),
      errores
    });
  }

  try {
    await db.collection('pacientes').updateOne({ _id: oid }, {
      $set: {
        nombre: values.nombre,
        especie: values.especie,
        raza: values.raza,
        sexo: values.sexo,
        fechaNacimiento: values.fechaNacimiento,
        peso: values.peso,
        tutorId: values.tutorId,
        alergias: values.alergias
      }
    });
    res.redirect(urlCon(`/pacientes/${oid}`, 'mensaje', 'Paciente actualizado con $set.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/vacunas', async (req, res, next) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.redirect(urlCon('/pacientes', 'error', 'Identificador no válido.'));

  const { values, errores } = validarVacuna(req.body);
  if (errores.length) {
    return res.redirect(urlCon(`/pacientes/${oid}`, 'error', errores.join(' ')));
  }

  try {
    await getDb().collection('pacientes').updateOne({ _id: oid }, {
      $push: { vacunas: { _id: new ObjectId(), ...values } }
    });
    res.redirect(urlCon(`/pacientes/${oid}`, 'mensaje', 'Vacuna agregada con $push.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/vacunas/eliminar', async (req, res, next) => {
  const oid = toObjectId(req.params.id);
  const vacunaId = toObjectId(req.body.vacunaId);
  if (!oid || !vacunaId) {
    return res.redirect(urlCon('/pacientes', 'error', 'Identificador no válido.'));
  }

  try {
    await getDb().collection('pacientes').updateOne({ _id: oid }, {
      $pull: { vacunas: { _id: vacunaId } }
    });
    res.redirect(urlCon(`/pacientes/${oid}`, 'mensaje', 'Vacuna eliminada con $pull.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/alergias', async (req, res, next) => {
  const oid = toObjectId(req.params.id);
  const alergia = texto(req.body.alergia);
  if (!oid || !alergia) {
    return res.redirect(urlCon('/pacientes', 'error', 'Datos no válidos.'));
  }

  try {
    await getDb().collection('pacientes').updateOne({ _id: oid }, {
      $addToSet: { alergias: alergia }
    });
    res.redirect(urlCon(`/pacientes/${oid}`, 'mensaje', 'Alergia agregada con $addToSet.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/alergias/eliminar', async (req, res, next) => {
  const oid = toObjectId(req.params.id);
  const alergia = texto(req.body.alergia);
  if (!oid || !alergia) {
    return res.redirect(urlCon('/pacientes', 'error', 'Datos no válidos.'));
  }

  try {
    await getDb().collection('pacientes').updateOne({ _id: oid }, {
      $pull: { alergias: alergia }
    });
    res.redirect(urlCon(`/pacientes/${oid}`, 'mensaje', 'Alergia eliminada con $pull.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.redirect(urlCon('/pacientes', 'error', 'Identificador no válido.'));

    const db = getDb();
    const dependientes = await db.collection('citas').countDocuments({ pacienteId: oid });
    if (dependientes > 0) {
      return res.redirect(urlCon(
        `/pacientes/${oid}`,
        'error',
        `No se puede eliminar: el paciente tiene ${dependientes} cita(s) registrada(s).`
      ));
    }

    const resultado = await db.collection('pacientes').deleteOne({ _id: oid });
    if (resultado.deletedCount === 0) {
      return res.redirect(urlCon('/pacientes', 'error', 'El paciente ya no existe.'));
    }
    res.redirect(urlCon('/pacientes', 'mensaje', 'Paciente eliminado correctamente.'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
