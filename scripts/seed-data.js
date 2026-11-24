'use strict';

const { ObjectId } = require('mongodb');

/** Fecha fija para que la semilla y los ejemplos del informe sean reproducibles. */
const FECHA_REFERENCIA = new Date('2026-11-23T10:00:00.000Z');
const DIA = 24 * 60 * 60 * 1000;

function rng(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const nombres = [
  'Ana María', 'Carlos Andrés', 'Luisa Fernanda', 'Jorge Alberto', 'María José',
  'Andrés Felipe', 'Claudia Patricia', 'Miguel Ángel', 'Sandra Milena', 'Ricardo Iván',
  'Paola Andrea', 'Fernando José', 'Gloria Stella', 'Oscar Eduardo', 'Liliana María',
  'Javier Orlando', 'Mónica Rodríguez', 'Diego Alejandro', 'Adriana Ximena', 'Héctor Fabio',
  'Natalia Estefanía', 'Wilson Alexander', 'Yamileth Lorena', 'Camilo Ernesto', 'Elizabeth Ángela',
  'Rafael Augusto', 'Tatiana Cristina', 'Manuel Francisco', 'Laura Valentina', 'Sergio Daniel'
];

const apellidos = [
  'Gómez', 'Rodríguez', 'Martínez', 'Hernández', 'López', 'González', 'Pérez', 'Sánchez',
  'Ramírez', 'Torres', 'Flores', 'Rivera', 'Castro', 'Ortiz', 'Rubiano', 'Moreno', 'Jiménez',
  'Suárez', 'Vargas', 'Reyes', 'Núñez', 'Díaz', 'Cárdenas', 'Bello'
];

const ciudades = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Pereira', 'Manizales', 'Armenia', 'Popayán', 'Neiva'];
const calles = ['Calle 72', 'Carrera 15', 'Avenida Colombia', 'Calle 100', 'Transversal 23', 'Carrera 7', 'Avenida El Dorado', 'Calle 45', 'Carrera 30', 'Diagonal 12'];

const especies = ['Perro', 'Gato', 'Ave', 'Reptil', 'Otro'];
const razasPorEspecie = {
  Perro: ['Labrador', 'Golden Retriever', 'Pastor Alemán', 'Bulldog', 'Poodle', 'Mestizo', 'Dachshund', 'Boxer'],
  Gato: ['Siamés', 'Persa', 'Maine Coon', 'Bengalí', 'Mestizo', 'Angora', 'British Shorthair'],
  Ave: ['Perico', 'Loro', 'Canario', 'Guacamaya', 'Cotorra'],
  Reptil: ['Tortuga', 'Iguana', 'Gecko', 'Serpiente'],
  Otro: ['Conejo', 'Hámster', 'Cuy', 'Erizo']
};

const especialidades = ['General', 'Cirugía', 'Dermatología', 'Cardiología', 'Odontología', 'Exóticos'];
const vacunas = ['Rabia', 'Distemper', 'Parvovirus', 'Adenovirus', 'Leptospirosis', 'Panleucopenia', 'Calicivirus', 'Herpesvirus'];
const servicios = ['Consulta', 'Vacunación', 'Desparasitación', 'Baño', 'Corte de uñas', 'Ecografía', 'Radiografía', 'Laboratorio', 'Cirugía', 'Control'];
const motivos = ['Control de rutina', 'Vacunación anual', 'Molestias digestivas', 'Lesión en la pata', 'Corte de uñas', 'Revisión dermatológica', 'Desparasitación', 'Seguimiento postoperatorio', 'Cambio de alimento', 'Chequeo general'];
const alergiasPosibles = ['Penicilina', 'Polen', 'Carne de pollo', 'Latex', 'Ninguna conocida', 'Granos', 'Dust mites'];
const observaciones = ['Paciente cooperativo.', 'Requiere control en 15 días.', 'Se recomienda dieta especial.', 'Sin hallazgos relevantes.', 'Dolor leve a la palpación.', ''];
const estados = ['Completada', 'Completada', 'Completada', 'Completada', 'Completada', 'Completada', 'Programada', 'Programada', 'Programada', 'En consulta', 'Cancelada', 'Cancelada'];

function fechaHace(random, minDias, maxDias) {
  return new Date(FECHA_REFERENCIA.getTime() - (minDias + random() * (maxDias - minDias)) * DIA);
}

function eligio(random, lista) {
  return lista[Math.floor(random() * lista.length)];
}

function entero(random, min, max) {
  return Math.floor(min + random() * (max - min + 1));
}

function decimal(random, min, max, digits = 1) {
  const valor = min + random() * (max - min);
  return Number(valor.toFixed(digits));
}

function generarDatos({ tutores = 120, pacientes = 260, veterinarios = 40, citas = 1400 } = {}) {
  const random = rng(20261123);

  const tutoresDocs = Array.from({ length: tutores }, (_, i) => ({
    _id: new ObjectId(),
    nombre: eligio(random, nombres),
    apellido: eligio(random, apellidos),
    documento: String(1000000 + i),
    telefono: `300${String(1000000 + i).slice(-7)}`,
    email: `tutor${i + 1}@correo.com`,
    direccion: {
      calle: `${eligio(random, calles)} # ${entero(random, 10, 95)} - ${entero(random, 10, 90)}`,
      ciudad: eligio(random, ciudades),
      codigoPostal: String(110001 + i)
    },
    createdAt: fechaHace(random, 30, 700)
  }));

  const pacientesDocs = Array.from({ length: pacientes }, (_, i) => {
    const especie = eligio(random, especies);
    const cantidadVacunas = entero(random, 0, 4);
    return {
      _id: new ObjectId(),
      nombre: eligio(random, ['Max', 'Luna', 'Rocky', 'Mía', 'Toby', 'Nina', 'Simón', 'Duna', 'Zeus', 'Kira', 'Bruno', 'Lola', 'Milo', 'Vera', 'Coco', 'Pipo', 'Sasha', 'Teo', 'Alma', 'Rex']),
      especie,
      raza: eligio(random, razasPorEspecie[especie]),
      sexo: eligio(random, ['Macho', 'Hembra']),
      fechaNacimiento: fechaHace(random, 180, 5000),
      peso: especie === 'Perro' ? decimal(random, 4, 38) : especie === 'Gato' ? decimal(random, 2.5, 8) : decimal(random, 0.3, 6),
      tutorId: tutoresDocs[entero(random, 0, tutoresDocs.length - 1)]._id,
      vacunas: Array.from({ length: cantidadVacunas }, () => {
        const fecha = fechaHace(random, 30, 1500);
        return {
          _id: new ObjectId(),
          nombre: eligio(random, vacunas),
          fecha,
          proximaDosis: random() > 0.25 ? new Date(fecha.getTime() + 365 * DIA) : null
        };
      }),
      alergias: Array.from({ length: entero(random, 0, 2) }, () => eligio(random, alergiasPosibles)),
      createdAt: fechaHace(random, 10, 600)
    };
  });

  const veterinariosDocs = Array.from({ length: veterinarios }, (_, i) => ({
    _id: new ObjectId(),
    nombre: `Dr. ${eligio(random, nombres)} ${eligio(random, apellidos)}`,
    especialidad: eligio(random, especialidades),
    licencia: `CO-${String(10000 + i)}`,
    telefono: `310${String(2000000 + i).slice(-7)}`,
    consultorio: `Consultorio ${entero(random, 1, 12)}`,
    activo: i % 9 !== 0,
    createdAt: fechaHace(random, 60, 900)
  }));

  const activos = veterinariosDocs.filter((v) => v.activo);
  const citasDocs = Array.from({ length: citas }, (_, i) => {
    const paciente = pacientesDocs[entero(random, 0, pacientesDocs.length - 1)];
    const veterinario = activos[entero(random, 0, activos.length - 1)];
    const esFutura = random() < 0.15;
    const fecha = esFutura
      ? new Date(FECHA_REFERENCIA.getTime() + entero(random, 1, 60) * DIA)
      : fechaHace(random, 1, 365);
    const estado = esFutura ? 'Programada' : eligio(random, estados);
    const tempBase = paciente.especie === 'Ave' ? 40.5 : paciente.especie === 'Reptil' ? 34.8 : 38.3;
    return {
      _id: new ObjectId(),
      pacienteId: paciente._id,
      veterinarioId: veterinario._id,
      fecha,
      motivo: eligio(random, motivos),
      estado,
      duracionMin: entero(random, 2, 6) * 15,
      costo: entero(random, 4, 25) * 10,
      signosVitales: {
        temperatura: decimal(random, tempBase - 0.7, tempBase + 0.7),
        frecuenciaCardiaca: entero(random, 70, 180),
        peso: paciente.peso
      },
      servicios: Array.from({ length: entero(random, 1, 3) }, () => eligio(random, servicios)),
      observaciones: eligio(random, observaciones),
      createdAt: new Date(Math.min(fecha.getTime() - entero(random, 1, 20) * DIA, FECHA_REFERENCIA.getTime()))
    };
  });

  return {
    tutores: tutoresDocs,
    pacientes: pacientesDocs,
    veterinarios: veterinariosDocs,
    citas: citasDocs,
    fechaReferencia: FECHA_REFERENCIA
  };
}

module.exports = { generarDatos, FECHA_REFERENCIA };
