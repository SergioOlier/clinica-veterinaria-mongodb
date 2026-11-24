'use strict';

const fechaCorta = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const fechaLarga = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const moneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

const decimal = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatearFecha(valor, conHora = false) {
  if (!valor || Number.isNaN(new Date(valor).getTime())) return '—';
  return (conHora ? fechaLarga : fechaCorta).format(new Date(valor));
}

function formatearMoneda(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '—';
  return moneda.format(Number(valor));
}

function formatearCelda(valor, key = '') {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (valor instanceof Date) return formatearFecha(valor, true);
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : '—';
  if (typeof valor === 'object' && valor.toString) {
    const texto = valor.toString();
    return /^[0-9a-fA-F]{24}$/.test(texto) ? texto : JSON.stringify(valor);
  }
  if (typeof valor === 'number') {
    if (/ingresos|costo|gasto/i.test(key)) return formatearMoneda(valor);
    if (/promedio/i.test(key)) return decimal.format(valor);
    return new Intl.NumberFormat('es-CO').format(valor);
  }
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return String(valor);
}

function paraInputFecha(valor) {
  if (!valor || Number.isNaN(new Date(valor).getTime())) return '';
  return new Date(valor).toISOString().slice(0, 10);
}

function paraInputDateTime(valor) {
  if (!valor || Number.isNaN(new Date(valor).getTime())) return '';
  return new Date(valor).toISOString().slice(0, 16);
}

module.exports = {
  formatearFecha,
  formatearMoneda,
  formatearCelda,
  paraInputFecha,
  paraInputDateTime
};
