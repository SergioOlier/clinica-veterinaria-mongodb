'use strict';

const express = require('express');
const { getDb } = require('../config/db');
const { ejecutarReportes } = require('../services/reportes');

const router = express.Router();

router.get('/', async (req, res) => {
  const reportes = await ejecutarReportes(getDb());
  res.render('reportes/index', { reportes });
});

module.exports = router;
