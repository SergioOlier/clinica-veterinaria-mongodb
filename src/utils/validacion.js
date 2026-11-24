'use strict';

const { ObjectId } = require('mongodb');

const ESPECIES = ['Perro', 'Gato', 'Ave', 'Reptil', 'Otro'];
const SEXOS = ['Macho', 'Hembra'];
const ESPECIALIDADES = ['General', 'Cirugía', 'Dermatología', 'Cardiología', 'Odontología', 'Exóticos'];
const ESTADOS = ['Programada', 'En consulta', 'Completada', 'Cancelada'];

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function escapeRegex(valor) {
  return texto(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function numero(valor) {
  if (valor === '' || valor === null || valor === undefined) return NaN;
  return Number(valor);
}

function fechaDesdeForm(valor) {
  const limpio = texto(valor);
  if (!limpio) return null;
  let fecha;
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    fecha = new Date(`${limpio}T00:00:00.000Z`);
  } else {
    fecha = new Date(limpio);
  }
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function objectIdDesdeForm(valor, nombre, errores) {
  const id = texto(valor);
  if (!id || !ObjectId.isValid(id)) {
    errores.push(`${nombre}: seleccione un registro válido.`);
    return null;
  }
  return new ObjectId(id);
}

function listaDesdeForm(valor) {
  const vista = new Set();
  return texto(valor)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const clave = item.toLocaleLowerCase('es');
      if (vista.has(clave)) return false;
      vista.add(clave);
      return true;
    });
}

function validarTutor(body) {
  const errores = [];
  const values = {
    nombre: texto(body.nombre),
    apellido: texto(body.apellido),
    documento: texto(body.documento),
    telefono: texto(body.telefono),
    email: texto(body.email),
    direccion: {
      calle: texto(body.calle),
      ciudad: texto(body.ciudad),
      codigoPostal: texto(body.codigoPostal)
    }
  };

  if (values.nombre.length < 2) errores.push('El nombre debe tener al menos 2 caracteres.');
  if (values.apellido.length < 2) errores.push('El apellido debe tener al menos 2 caracteres.');
  if (!/^\d{6,12}$/.test(values.documento)) errores.push('El documento debe tener entre 6 y 12 dígitos.');
  if (!/^\d{7,15}$/.test(values.telefono)) errores.push('El teléfono debe tener entre 7 y 15 dígitos.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errores.push('Ingrese un correo electrónico válido.');
  if (values.direccion.calle.length < 3) errores.push('La calle debe tener al menos 3 caracteres.');
  if (values.direccion.ciudad.length < 2) errores.push('La ciudad debe tener al menos 2 caracteres.');
  if (!/^\d{4,10}$/.test(values.direccion.codigoPostal)) errores.push('El código postal debe tener entre 4 y 10 dígitos.');

  return { values, errores };
}

function validarPaciente(body) {
  const errores = [];
  const tutorIdTexto = texto(body.tutorId);
  const fechaNacimiento = fechaDesdeForm(body.fechaNacimiento);
  const peso = numero(body.peso);

  const values = {
    nombre: texto(body.nombre),
    especie: texto(body.especie),
    raza: texto(body.raza),
    sexo: texto(body.sexo),
    fechaNacimiento,
    peso,
    tutorIdTexto,
    tutorId: objectIdDesdeForm(tutorIdTexto, 'El tutor', errores),
    alergias: listaDesdeForm(body.alergias)
  };

  if (!values.nombre) errores.push('El nombre del paciente es obligatorio.');
  if (!ESPECIES.includes(values.especie)) errores.push('Seleccione una especie válida.');
  if (!values.raza) errores.push('La raza es obligatoria.');
  if (!SEXOS.includes(values.sexo)) errores.push('Seleccione un sexo válido.');
  if (!fechaNacimiento) errores.push('La fecha de nacimiento no es válida.');
  if (!Number.isFinite(peso) || peso < 0.1 || peso > 120) errores.push('El peso debe estar entre 0.1 y 120 kg.');

  return { values, errores };
}

function validarVeterinario(body) {
  const errores = [];
  const values = {
    nombre: texto(body.nombre),
    especialidad: texto(body.especialidad),
    licencia: texto(body.licencia),
    telefono: texto(body.telefono),
    consultorio: texto(body.consultorio),
    activo: body.activo === 'on' || body.activo === 'true' || body.activo === true
  };

  if (values.nombre.length < 2) errores.push('El nombre debe tener al menos 2 caracteres.');
  if (!ESPECIALIDADES.includes(values.especialidad)) errores.push('Seleccione una especialidad válida.');
  if (!/^[A-Z]{2}-\d{5}$/.test(values.licencia)) errores.push('La licencia debe tener el formato CO-12345.');
  if (!/^\d{7,15}$/.test(values.telefono)) errores.push('El teléfono debe tener entre 7 y 15 dígitos.');

  return { values, errores };
}

function validarCita(body) {
  const errores = [];
  const pacienteIdTexto = texto(body.pacienteId);
  const veterinarioIdTexto = texto(body.veterinarioId);
  const fecha = fechaDesdeForm(body.fecha);
  const motivo = texto(body.motivo);
  const estado = texto(body.estado);
  const duracionMin = numero(body.duracionMin);
  const costo = numero(body.costo);
  const temperatura = numero(body.temperatura);
  const frecuenciaCardiaca = numero(body.frecuenciaCardiaca);
  const pesoVital = numero(body.pesoVital);

  const values = {
    pacienteIdTexto,
    pacienteId: objectIdDesdeForm(pacienteIdTexto, 'El paciente', errores),
    veterinarioIdTexto,
    veterinarioId: objectIdDesdeForm(veterinarioIdTexto, 'El veterinario', errores),
    fecha,
    motivo,
    estado,
    duracionMin,
    costo,
    signosVitales: { temperatura, frecuenciaCardiaca, peso: pesoVital },
    servicios: listaDesdeForm(body.servicios),
    observaciones: texto(body.observaciones)
  };

  if (!fecha) errores.push('La fecha y hora de la cita no son válidas.');
  if (motivo.length < 3) errores.push('El motivo debe tener al menos 3 caracteres.');
  if (!ESTADOS.includes(estado)) errores.push('Seleccione un estado válido.');
  if (!Number.isInteger(duracionMin) || duracionMin < 15 || duracionMin > 180) errores.push('La duración debe ser un entero entre 15 y 180 minutos.');
  if (!Number.isFinite(costo) || costo < 0) errores.push('El costo no puede ser negativo.');
  if (!Number.isFinite(temperatura) || temperatura < 34 || temperatura > 43) errores.push('La temperatura debe estar entre 34 y 43 °C.');
  if (!Number.isInteger(frecuenciaCardiaca) || frecuenciaCardiaca < 40 || frecuenciaCardiaca > 260) errores.push('La frecuencia cardíaca debe estar entre 40 y 260 lpm.');
  if (!Number.isFinite(pesoVital) || pesoVital < 0.1 || pesoVital > 120) errores.push('El peso registrado debe estar entre 0.1 y 120 kg.');
  if (values.servicios.length === 0) errores.push('Debe registrar al menos un servicio.');

  return { values, errores };
}

function validarVacuna(body) {
  const errores = [];
  const fecha = fechaDesdeForm(body.fecha);
  const proximaDosis = texto(body.proximaDosis) ? fechaDesdeForm(body.proximaDosis) : null;
  const values = {
    nombre: texto(body.nombre),
    fecha,
    proximaDosis
  };

  if (values.nombre.length < 2) errores.push('El nombre de la vacuna es obligatorio.');
  if (!fecha) errores.push('La fecha de aplicación no es válida.');
  if (texto(body.proximaDosis) && !proximaDosis) errores.push('La próxima dosis no es válida.');

  return { values, errores };
}

function validarServicio(body) {
  const errores = [];
  const values = { nombre: texto(body.nombre) };
  if (values.nombre.length < 2) errores.push('El servicio debe tener al menos 2 caracteres.');
  return { values, errores };
}

module.exports = {
  ESPECIES,
  SEXOS,
  ESPECIALIDADES,
  ESTADOS,
  texto,
  escapeRegex,
  fechaDesdeForm,
  listaDesdeForm,
  validarTutor,
  validarPaciente,
  validarVeterinario,
  validarCita,
  validarVacuna,
  validarServicio
};
