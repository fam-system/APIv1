const express = require('express');
const jwt = require("jsonwebtoken");
const fs = require('fs');
const pool = require('../db');
const bcrypt = require('bcrypt');

const configContent = fs.readFileSync('config.json');
const config = JSON.parse(configContent);
const token_secret = config.secret || "Demo123";

// Middleware de Autenticación por Token
async function token_auth(req, res, next) {
  try {
    const username = req.body.nombreUsuario;
    const password = req.body.pass;

    if (!username) {
      return res.status(400).json({
        info: 'error',
        status: false,
        message: 'Autenticación fallida, El campo "username" es Obligatorio.',
        timestamp: new Date().toISOString()
      });
    }

    if (!password) {
      return res.status(400).json({
        info: 'error',
        status: false,
        message: 'Autenticación fallida, El campo "password" es Obligatorio.',
        timestamp: new Date().toISOString()
      });
    }

    // Buscar usuario en base de datos
    const [rows] = await pool.query(
      'SELECT usuarios.idUsuario, usuarios.nombreUsuario, usuarios.pass, roles.idRol FROM usuarios JOIN roles ON usuarios.idRol = roles.idRol WHERE usuarios.nombreUsuario = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        info: 'error',
        status: false,
        message: 'Autenticación fallida, El usuario no existe.',
        timestamp: new Date().toISOString()
      });
    }

    const usuario = rows[0];

    // Comparar la contraseña encriptada
    const match = await bcrypt.compare(password, usuario.pass);
    if (!match) {
      return res.status(401).json({
        info: 'error',
        status: false,
        message: 'Contraseña incorrecta.',
        timestamp: new Date().toISOString()
      });
    }

    // Generar token
    const token_payload = {
      idUsuario: usuario.idUsuario,
      idRol: usuario.idRol,
      nombreUsuario: usuario.nombreUsuario
    };
    const token = jwt.sign(token_payload, token_secret, { expiresIn: "1h" });

    // Adjuntar datos al request
    req.token = token;
    req.idRol = usuario.idRol;
    req.idUsuario = usuario.idUsuario;
    req.nombreUsuario = usuario.nombreUsuario;

    next();

  } catch (error) {
    return res.status(500).json({
      info: 'error',
      status: false,
      message: 'Error en el servidor.',
      timestamp: new Date().toISOString()
    });
  }
}

// Verificación del token JWT
function verify_token(req, res, next) {
  const header = req.header("Authorization") || "";
  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      info: 'error',
      status: false,
      message: 'Autenticación fallida, El Token es Obligatorio.',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const payload = jwt.verify(token, token_secret);
    req.idRol = payload.idRol;
    req.idUsuario = payload.idUsuario;
    req.nombreUsuario = payload.nombreUsuario;
    next();
  } catch (error) {
    return res.status(403).json({
      info: 'error',
      status: false,
      message: 'Token inválido o expirado.',
      timestamp: new Date().toISOString()
    });
  }
}

// Middleware para autorización por rol
function authorize_roles(...rolesPermitidos) {
  return (req, res, next) => {
    const header = req.header("Authorization") || "";
    const token = header.split(" ")[1];
    const payload = jwt.verify(token, token_secret);
    const rol = payload.idRol;

    if (!rolesPermitidos.includes(rol)) {
      return res.status(403).json({
        info: 'error',
        status: false,
        message: 'Acceso denegado. Rol no autorizado.',
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

module.exports = { token_auth, verify_token, authorize_roles };