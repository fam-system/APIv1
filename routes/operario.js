const express = require('express');

const pool = require('../db');
const app = express.Router();

const {verify_token, authorize_roles} = require('../middleware/auth_middleware');

app.get('/inicio/:id', verify_token, authorize_roles(4), async function (req, res) {

  try {
    const { id } = req.params;
    const [rows] = await pool.query(`SELECT
    trabajos.tiempoProduccion,puestos.nombrePuesto,empleados.nombreEmpleado,empleados.apellidoEmpleado,procesos.fechaInicio,procesos.cantidadProducto,productos.nombreProducto,procesos.estadoProducto,productos.tiempoProduccionEstimado,procesos.idProceso
FROM
    trabajos
JOIN
	empleados ON trabajos.idEmpleado = empleados.idEmpleado
JOIN
    puestos ON trabajos.idPuesto = puestos.idPuesto
JOIN
    procesos ON trabajos.idProceso = procesos.idProceso
JOIN
	productos ON procesos.idProducto = productos.idProducto
WHERE
	empleados.idEmpleado = ?
`,[id]);
if (rows.length === 0) {
      return res.status(404).json({ message: 'Esperando producto...' });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.get('/tipoincidencias', verify_token, authorize_roles(4), async function (req, res) {

  try {
    const [rows] = await pool.query(`SELECT * FROM tiposIncidencias`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.get('/producto/:id', verify_token, authorize_roles(4), async function (req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`SELECT
      productos.nombreProducto,productos.tiempoProduccionEstimado,planos.nombrePlano,planos.urlPlano
      FROM productos
      JOIN planos ON productos.idProducto = planos.idProducto
      JOIN procesos ON productos.idProducto = procesos.idProducto
      JOIN trabajos ON procesos.idProceso = trabajos.idProceso
      JOIN empleados ON trabajos.idEmpleado = empleados.idEmpleado
      JOIN usuarios ON empleados.idEmpleado = usuarios.idEmpleado
      WHERE usuarios.idUsuario = ? and (procesos.estadoProducto = 'produccion' or procesos.estadoProducto = 'asignado');
      `,[id]);//hay que cambier idusuario por idproceso para que no me cargue todos los productos
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.post('/iniciartarea', verify_token, authorize_roles(4), async function (req, res) {

  try {
    const { idUsuario } = req.body;
    const [rows] = await pool.query(`UPDATE procesos
        JOIN trabajos ON trabajos.idProceso = procesos.idProceso
        JOIN empleados ON empleados.idEmpleado = trabajos.idEmpleado
        JOIN usuarios ON usuarios.idEmpleado = empleados.idEmpleado
        SET procesos.estadoProducto = 'produccion',
        procesos.fechaInicio = CURDATE()
        WHERE usuarios.idUsuario = ?;
      `,[idUsuario]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.post('/finalizartarea', verify_token, authorize_roles(4), async function (req, res) {
  const connection = await pool.getConnection();
  try {
    const { idUsuario, tiempoProduccion ,idProceso} = req.body;

    await connection.beginTransaction();

    await connection.query(`
      UPDATE procesos
      JOIN trabajos ON trabajos.idProceso = procesos.idProceso
      JOIN empleados ON empleados.idEmpleado = trabajos.idEmpleado
      JOIN usuarios ON usuarios.idEmpleado = empleados.idEmpleado
      join puestos ON puestos.idPuesto = trabajos.idPuesto
      SET
        procesos.estadoProducto = 'terminado',
        procesos.fechaFin = CURDATE(),
        puestos.disponible = 0
      WHERE usuarios.idUsuario = ?;
    `, [idUsuario]);

    await connection.query(`
      UPDATE trabajos
      JOIN empleados ON empleados.idEmpleado = trabajos.idEmpleado
      JOIN usuarios ON usuarios.idEmpleado = empleados.idEmpleado
      JOIN procesos ON procesos.idProceso = trabajos.idProceso
      SET
        trabajos.tiempoProduccion = ?
      WHERE procesos.idProceso = ? AND usuarios.idUsuario = ?;
    `, [tiempoProduccion, idProceso, idUsuario]);

    await connection.query(`
      UPDATE empleados
      JOIN usuarios ON usuarios.idEmpleado = empleados.idEmpleado
      SET
        empleados.estadoEmpleado = 0
      WHERE usuarios.idUsuario = ?;
    `, [idUsuario]);

    await connection.commit();
    res.json({ success: true });

  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.post('/incidencia', verify_token, authorize_roles(4), async function (req, res) {

  try {
    const { idProceso,descripcion,idTipoIncidencia } = req.body;
    const [rows] = await pool.query(`INSERT INTO incidencias
      (idProceso, descripcion, idTipoIncidencia, fechaIncidencia, vistaIncidencia)
      VALUES (?, ?, ?, ?, ?);
      `,[idProceso, descripcion, idTipoIncidencia, new Date(),'0']);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/logout', verify_token, authorize_roles(4), async function (req, res) {

  try {
    const { idUsuario,tiempoProduccion } = req.body;
    const [rows] = await pool.query(`UPDATE trabajos
      JOIN empleados ON empleados.idEmpleado = trabajos.idEmpleado
      JOIN usuarios ON usuarios.idEmpleado = empleados.idEmpleado
      set tiempoProduccion = ?
    WHERE idUsuario = ?;
    `,[tiempoProduccion, idUsuario]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

module.exports = app;
