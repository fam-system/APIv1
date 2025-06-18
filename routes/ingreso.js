const express = require('express');
const app = express.Router();
const { token_auth, verify_token, authorize_roles } = require('../middleware/auth_middleware');

// LOGIN: se autentica el usuario, se genera el token y se devuelve info relevante
app.post('/login', token_auth, async function (req, res) {
  res.json({
    info: 'ok',
    status: true,
    message: 'Autenticación Completada, Sesión Iniciada.',
    timestamp: new Date().toISOString(),
    token: req.token,
    user: {
      idRol: req.idRol,
      idUsuario: req.idUsuario,
      nombreUsuario: req.nombreUsuario
    }
  });
});

// Ruta opcional para registrar nuevo usuario (requiere implementación)
app.post('/newuser', token_auth, async function (req, res) {
  const { username, pass } = req.body;
  res.json({
    info: 'ok',
    status: true,
    message: 'Sesión iniciada para nuevo usuario.',
    timestamp: new Date().toISOString(),
    token: req.token
  });
});

module.exports = app;