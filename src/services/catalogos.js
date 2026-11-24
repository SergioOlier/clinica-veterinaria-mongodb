'use strict';

async function tutoresParaSelect(db) {
  return db.collection('tutores')
    .find({}, { projection: { nombre: 1, apellido: 1, documento: 1 } })
    .sort({ nombre: 1, apellido: 1 })
    .toArray();
}

async function pacientesParaSelect(db) {
  return db.collection('pacientes').aggregate([
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
      $set: {
        etiqueta: {
          $concat: [
            '$nombre',
            ' — ',
            { $ifNull: ['$tutor.nombre', 'Sin tutor'] },
            ' (',
            '$especie',
            ')'
          ]
        }
      }
    },
    { $project: { nombre: 1, especie: 1, etiqueta: 1 } },
    { $sort: { nombre: 1 } }
  ]).toArray();
}

async function veterinariosParaSelect(db) {
  return db.collection('veterinarios')
    .find({}, { projection: { nombre: 1, especialidad: 1, activo: 1 } })
    .sort({ activo: -1, nombre: 1 })
    .toArray();
}

module.exports = { tutoresParaSelect, pacientesParaSelect, veterinariosParaSelect };
