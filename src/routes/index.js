'use strict';

const express = require('express');
const { getDb } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const db = getDb();

  const [tutores, pacientes, veterinarios, citas] = await Promise.all([
    db.collection('tutores').countDocuments(),
    db.collection('pacientes').countDocuments(),
    db.collection('veterinarios').countDocuments(),
    db.collection('citas').countDocuments()
  ]);

  const [recientes, porEstado, ingresos] = await Promise.all([
    db.collection('citas').aggregate([
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
      { $set: { paciente: { $arrayElemAt: ['$paciente', 0] }, veterinario: { $arrayElemAt: ['$veterinario', 0] } } },
      { $sort: { fecha: -1 } },
      { $limit: 7 },
      {
        $project: {
          fecha: 1,
          motivo: 1,
          estado: 1,
          pacienteNombre: '$paciente.nombre',
          veterinarioNombre: '$veterinario.nombre'
        }
      }
    ]).toArray(),
    db.collection('citas').aggregate([
      { $group: { _id: '$estado', total: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]).toArray(),
    db.collection('citas').aggregate([
      { $match: { estado: 'Completada' } },
      { $group: { _id: null, total: { $sum: '$costo' } } }
    ]).toArray()
  ]);

  const maxEstado = Math.max(1, ...porEstado.map((item) => item.total));

  res.render('index', {
    totals: { tutores, pacientes, veterinarios, citas },
    recientes,
    porEstado: porEstado.map((item) => ({ ...item, porcentaje: Math.round((item.total / maxEstado) * 100) })),
    ingresos: ingresos[0]?.total || 0
  });
});

module.exports = router;
