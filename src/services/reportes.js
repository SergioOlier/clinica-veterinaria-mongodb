'use strict';

const { FECHA_REFERENCIA } = require('../../scripts/seed-data');

/**
 * Consultas avanzadas con el framework de agregación.
 * Cada objeto expone la pregunta de negocio, el pipeline completo, las columnas
 * a mostrar y la interpretación que se reproducen en la pantalla /reportes.
 */

function pipelineCitasPorVeterinario() {
  return [
    { $match: { estado: 'Completada' } },
    {
      $lookup: {
        from: 'veterinarios',
        localField: 'veterinarioId',
        foreignField: '_id',
        as: 'veterinario'
      }
    },
    { $unwind: '$veterinario' },
    {
      $group: {
        _id: {
          veterinario: '$veterinario.nombre',
          especialidad: '$veterinario.especialidad'
        },
        totalCitas: { $sum: 1 },
        ingresos: { $sum: '$costo' },
        duracionPromedio: { $avg: '$duracionMin' }
      }
    },
    {
      $project: {
        _id: 0,
        veterinario: '$_id.veterinario',
        especialidad: '$_id.especialidad',
        totalCitas: 1,
        ingresos: { $round: ['$ingresos', 2] },
        duracionPromedio: { $round: ['$duracionPromedio', 1] }
      }
    },
    { $sort: { totalCitas: -1 } }
  ];
}

function pipelinePromedioPorEspecie() {
  return [
    { $match: { estado: 'Completada' } },
    {
      $lookup: {
        from: 'pacientes',
        localField: 'pacienteId',
        foreignField: '_id',
        as: 'paciente'
      }
    },
    { $unwind: '$paciente' },
    {
      $group: {
        _id: '$paciente.especie',
        totalCitas: { $sum: 1 },
        gastoPromedio: { $avg: '$costo' },
        ingresos: { $sum: '$costo' }
      }
    },
    {
      $project: {
        _id: 0,
        especie: '$_id',
        totalCitas: 1,
        gastoPromedio: { $round: ['$gastoPromedio', 2] },
        ingresos: { $round: ['$ingresos', 2] }
      }
    },
    { $sort: { gastoPromedio: -1 } }
  ];
}

function pipelineTopPacientes() {
  return [
    { $match: { estado: 'Completada' } },
    { $addFields: { cantidadServicios: { $size: '$servicios' } } },
    {
      $lookup: {
        from: 'pacientes',
        localField: 'pacienteId',
        foreignField: '_id',
        as: 'paciente'
      }
    },
    { $unwind: '$paciente' },
    {
      $lookup: {
        from: 'tutores',
        localField: 'paciente.tutorId',
        foreignField: '_id',
        as: 'tutor'
      }
    },
    { $unwind: '$tutor' },
    {
      $group: {
        _id: {
          paciente: '$paciente.nombre',
          tutor: { $concat: ['$tutor.nombre', ' ', '$tutor.apellido'] },
          especie: '$paciente.especie'
        },
        totalCitas: { $sum: 1 },
        totalServicios: { $sum: '$cantidadServicios' },
        ingresos: { $sum: '$costo' }
      }
    },
    {
      $project: {
        _id: 0,
        paciente: '$_id.paciente',
        tutor: '$_id.tutor',
        especie: '$_id.especie',
        totalCitas: 1,
        totalServicios: 1,
        ingresos: { $round: ['$ingresos', 2] }
      }
    },
    { $sort: { totalServicios: -1 } },
    { $limit: 5 }
  ];
}

function pipelineEvolucionMensual() {
  // Se usa la fecha de referencia de la semilla para que el ejemplo sea reproducible.
  const fin = new Date(FECHA_REFERENCIA.getTime());
  const inicio = new Date(fin);
  inicio.setFullYear(inicio.getFullYear() - 1);

  return [
    { $match: { fecha: { $gte: inicio, $lte: fin } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$fecha' } },
        totalCitas: { $sum: 1 },
        ingresos: { $sum: '$costo' }
      }
    },
    {
      $project: {
        _id: 0,
        mes: '$_id',
        totalCitas: 1,
        ingresos: { $round: ['$ingresos', 2] }
      }
    },
    { $sort: { mes: 1 } }
  ];
}

const reportes = [
  {
    id: 'citas-por-veterinario',
    titulo: 'Citas completadas por veterinario',
    pregunta: '¿Cuántas citas completó cada veterinario y cuántos ingresos generó?',
    descripcion: 'Filtra citas completadas, une con veterinarios y agrupa por profesional.',
    getPipeline: pipelineCitasPorVeterinario,
    columns: [
      { key: 'veterinario', label: 'Veterinario' },
      { key: 'especialidad', label: 'Especialidad' },
      { key: 'totalCitas', label: 'Citas' },
      { key: 'ingresos', label: 'Ingresos' },
      { key: 'duracionPromedio', label: 'Duración prom. (min)' }
    ],
    interpretacion: 'Permite identificar al veterinario con mayor carga de trabajo y su aporte económico. Útil para incentivos y distribución de agenda.',
    pantalla: 'Reportes → "Citas completadas por veterinario"',
    ejemplo: [
      { veterinario: 'Dr. Liliana María Cárdenas', especialidad: 'Dermatología', totalCitas: 29, ingresos: 4090, duracionPromedio: 63.1 },
      { veterinario: 'Dr. Claudia Patricia González', especialidad: 'Dermatología', totalCitas: 28, ingresos: 4040, duracionPromedio: 64.3 },
      { veterinario: 'Dr. Liliana María Ramírez', especialidad: 'Dermatología', totalCitas: 24, ingresos: 3480, duracionPromedio: 58.8 }
    ]
  },
  {
    id: 'promedio-por-especie',
    titulo: 'Gasto promedio por especie',
    pregunta: '¿Cuál es el gasto promedio por cita según la especie del paciente?',
    descripcion: 'Une citas con pacientes y calcula promedios e ingresos por especie.',
    getPipeline: pipelinePromedioPorEspecie,
    columns: [
      { key: 'especie', label: 'Especie' },
      { key: 'totalCitas', label: 'Citas' },
      { key: 'gastoPromedio', label: 'Gasto promedio' },
      { key: 'ingresos', label: 'Ingresos totales' }
    ],
    interpretacion: 'Muestra qué especies generan ticket promedio más alto. Sirve para ajustar precios, campañas y recursos (ej.: exóticos requieren especialistas).',
    pantalla: 'Reportes → "Gasto promedio por especie"',
    ejemplo: [
      { especie: 'Perro', totalCitas: 117, gastoPromedio: 152.22, ingresos: 17810 },
      { especie: 'Gato', totalCitas: 133, gastoPromedio: 145.71, ingresos: 19380 },
      { especie: 'Reptil', totalCitas: 120, gastoPromedio: 143.08, ingresos: 17170 }
    ]
  },
  {
    id: 'top-pacientes',
    titulo: 'Top 5 de pacientes con más servicios',
    pregunta: '¿Qué pacientes recibieron más servicios y cuánto facturaron?',
    descripcion: 'Cuenta los servicios por cita y une paciente y tutor mediante $lookup.',
    getPipeline: pipelineTopPacientes,
    columns: [
      { key: 'paciente', label: 'Paciente' },
      { key: 'tutor', label: 'Tutor' },
      { key: 'especie', label: 'Especie' },
      { key: 'totalCitas', label: 'Citas' },
      { key: 'totalServicios', label: 'Servicios' },
      { key: 'ingresos', label: 'Ingresos' }
    ],
    interpretacion: 'Identifica clientes frecuentes para programas de fidelización y control de historial clínico. Usa $limit para mostrar solo el ranking superior.',
    pantalla: 'Reportes → "Top 5 de pacientes con más servicios"',
    ejemplo: [
      { paciente: 'Vera', tutor: 'Gloria Stella Núñez', especie: 'Otro', totalCitas: 9, totalServicios: 20, ingresos: 1510 },
      { paciente: 'Bruno', tutor: 'Adriana Ximena Jiménez', especie: 'Gato', totalCitas: 6, totalServicios: 17, ingresos: 970 },
      { paciente: 'Kira', tutor: 'Gloria Stella Núñez', especie: 'Perro', totalCitas: 7, totalServicios: 16, ingresos: 900 }
    ]
  },
  {
    id: 'evolucion-mensual',
    titulo: 'Evolución mensual de citas',
    pregunta: '¿Cómo evolucionaron las citas y los ingresos mes a mes en el último año (fecha de referencia de la semilla)?',
    descripcion: 'Filtra por rango de fechas, agrupa por mes con $dateToString y ordena cronológicamente.',
    getPipeline: pipelineEvolucionMensual,
    columns: [
      { key: 'mes', label: 'Mes' },
      { key: 'totalCitas', label: 'Citas' },
      { key: 'ingresos', label: 'Ingresos' }
    ],
    interpretacion: 'Permite detectar temporadas de alta y baja demanda para planear horarios, inventario y campañas preventivas.',
    pantalla: 'Reportes → "Evolución mensual de citas"',
    ejemplo: [
      { mes: '2025-11', totalCitas: 19, ingresos: 2560 },
      { mes: '2025-12', totalCitas: 111, ingresos: 16560 },
      { mes: '2026-01', totalCitas: 109, ingresos: 16080 }
    ]
  }
];

async function ejecutarReportes(db) {
  return Promise.all(
    reportes.map(async (reporte) => {
      const pipeline = reporte.getPipeline();
      const datos = await db.collection('citas').aggregate(pipeline).toArray();
      return { ...reporte, pipeline, datos };
    })
  );
}

module.exports = { reportes, ejecutarReportes };
