'use strict';

/**
 * Validación de esquema ($jsonSchema) e índices de la base de datos.
 * Se aplica con `npm run setup` y también al arrancar el servidor.
 */

const validators = {
  tutores: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['nombre', 'apellido', 'documento', 'telefono', 'email', 'direccion', 'createdAt'],
      properties: {
        nombre: { bsonType: 'string', minLength: 2, maxLength: 60, description: 'Nombre del tutor' },
        apellido: { bsonType: 'string', minLength: 2, maxLength: 60 },
        documento: { bsonType: 'string', pattern: '^[0-9]{6,12}$' },
        telefono: { bsonType: 'string', pattern: '^[0-9]{7,15}$' },
        email: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
        direccion: {
          bsonType: 'object',
          required: ['calle', 'ciudad', 'codigoPostal'],
          properties: {
            calle: { bsonType: 'string', minLength: 3 },
            ciudad: { bsonType: 'string', minLength: 2 },
            codigoPostal: { bsonType: 'string', pattern: '^[0-9]{4,10}$' }
          }
        },
        createdAt: { bsonType: 'date' }
      }
    }
  },

  pacientes: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'nombre', 'especie', 'raza', 'sexo', 'fechaNacimiento', 'peso',
        'tutorId', 'vacunas', 'alergias', 'createdAt'
      ],
      properties: {
        nombre: { bsonType: 'string', minLength: 1, maxLength: 60 },
        especie: { enum: ['Perro', 'Gato', 'Ave', 'Reptil', 'Otro'] },
        raza: { bsonType: 'string', minLength: 1, maxLength: 60 },
        sexo: { enum: ['Macho', 'Hembra'] },
        fechaNacimiento: { bsonType: 'date' },
        peso: { bsonType: 'number', minimum: 0.1, maximum: 120 },
        tutorId: { bsonType: 'objectId' },
        vacunas: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['_id', 'nombre', 'fecha'],
            properties: {
              _id: { bsonType: 'objectId' },
              nombre: { bsonType: 'string', minLength: 2 },
              fecha: { bsonType: 'date' },
              proximaDosis: { bsonType: ['date', 'null'] }
            }
          }
        },
        alergias: { bsonType: 'array', items: { bsonType: 'string' } },
        createdAt: { bsonType: 'date' }
      }
    }
  },

  veterinarios: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['nombre', 'especialidad', 'licencia', 'telefono', 'activo', 'createdAt'],
      properties: {
        nombre: { bsonType: 'string', minLength: 2, maxLength: 80 },
        especialidad: { enum: ['General', 'Cirugía', 'Dermatología', 'Cardiología', 'Odontología', 'Exóticos'] },
        licencia: { bsonType: 'string', pattern: '^[A-Z]{2}-[0-9]{5}$' },
        telefono: { bsonType: 'string', pattern: '^[0-9]{7,15}$' },
        consultorio: { bsonType: 'string' },
        activo: { bsonType: 'bool' },
        createdAt: { bsonType: 'date' }
      }
    }
  },

  citas: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'pacienteId', 'veterinarioId', 'fecha', 'motivo', 'estado',
        'duracionMin', 'costo', 'signosVitales', 'servicios', 'createdAt'
      ],
      properties: {
        pacienteId: { bsonType: 'objectId' },
        veterinarioId: { bsonType: 'objectId' },
        fecha: { bsonType: 'date' },
        motivo: { bsonType: 'string', minLength: 3, maxLength: 200 },
        estado: { enum: ['Programada', 'En consulta', 'Completada', 'Cancelada'] },
        duracionMin: { bsonType: ['int', 'double', 'long'], minimum: 15, maximum: 180 },
        costo: { bsonType: 'number', minimum: 0 },
        signosVitales: {
          bsonType: 'object',
          required: ['temperatura', 'frecuenciaCardiaca', 'peso'],
          properties: {
            temperatura: { bsonType: 'number', minimum: 34, maximum: 43 },
            frecuenciaCardiaca: { bsonType: ['int', 'double', 'long'], minimum: 40, maximum: 260 },
            peso: { bsonType: 'number', minimum: 0.1, maximum: 120 }
          }
        },
        servicios: { bsonType: 'array', items: { bsonType: 'string' } },
        observaciones: { bsonType: 'string' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
};

const indexes = {
  tutores: [
    { keys: { documento: 1 }, options: { name: 'ux_tutores_documento', unique: true } },
    { keys: { email: 1 }, options: { name: 'ix_tutores_email' } },
    { keys: { 'direccion.ciudad': 1 }, options: { name: 'ix_tutores_ciudad' } }
  ],
  pacientes: [
    { keys: { tutorId: 1 }, options: { name: 'ix_pacientes_tutorId' } },
    { keys: { especie: 1 }, options: { name: 'ix_pacientes_especie' } }
  ],
  veterinarios: [
    { keys: { licencia: 1 }, options: { name: 'ux_veterinarios_licencia', unique: true } },
    { keys: { activo: 1, especialidad: 1 }, options: { name: 'ix_veterinarios_activos_especialidad' } }
  ],
  citas: [
    { keys: { pacienteId: 1 }, options: { name: 'ix_citas_pacienteId' } },
    { keys: { veterinarioId: 1 }, options: { name: 'ix_citas_veterinarioId' } },
    { keys: { fecha: -1 }, options: { name: 'ix_citas_fecha' } },
    { keys: { estado: 1, fecha: -1 }, options: { name: 'ix_citas_estado_fecha' } }
  ]
};

async function setupDatabase(db) {
  for (const [name, validator] of Object.entries(validators)) {
    try {
      await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
    } catch (error) {
      if (error.code !== 48) throw error; // 48 = NamespaceExists
      await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
    }
  }

  for (const [name, list] of Object.entries(indexes)) {
    await db.collection(name).createIndexes(list.map(({ keys, options }) => ({ key: keys, ...options })));
  }

  return { validators: Object.keys(validators), indexes: Object.keys(indexes) };
}

module.exports = { validators, indexes, setupDatabase };
