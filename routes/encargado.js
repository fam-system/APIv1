const express = require('express');

const pool = require('../db');
const app = express.Router();

const {verify_token, authorize_roles} = require('../middleware/auth_middleware');

app.get('/tareas', verify_token, authorize_roles(2), async function (req, res) {

  try {
    const [rows] = await pool.query(`SELECT
    procesos.idProceso,procesos.nombreProceso,procesos.cantidadProducto
FROM
    procesos
WHERE
	procesos.estadoProducto = 'pendiente'
`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.get('/puestos', verify_token, authorize_roles(2), async function (req, res) {

  try {
    const [rows] = await pool.query(`SELECT
    puestos.idPuesto,puestos.nombrePuesto,Puestos.disponible
FROM
    puestos
WHERE
	puestos.disponible = 0
`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.get('/empleados', verify_token, authorize_roles(2), async function (req, res) {

  try {
    const [rows] = await pool.query(`SELECT
    empleados.idEmpleado,empleados.nombreEmpleado,empleados.apellidoEmpleado
  FROM
    empleados
  WHERE
	  empleados.estadoEmpleado = 0 AND empleados.bajaEmpleado = 0
`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.post('/asignar', verify_token, authorize_roles(2), async function (req, res) {
  const connection = await pool.getConnection();
  try {
    const { idProceso, idPuesto, idEmpleado } = req.body;

    await connection.beginTransaction();

    await connection.query(
      'INSERT INTO trabajos (tiempoProduccion, idProceso, idPuesto, idEmpleado) VALUES (?, ?, ?, ?)',
      [0, idProceso, idPuesto, idEmpleado]
    );

    await connection.query(
      'UPDATE procesos SET estadoProducto = "asignado" WHERE idProceso = ?',
      [idProceso]
    );

    await connection.query(
      'UPDATE puestos SET disponible = 1 WHERE idPuesto = ?',
      [idPuesto]
    );

    await connection.query(
      'UPDATE empleados SET estadoEmpleado = 1 WHERE idEmpleado = ?',
      [idEmpleado]
    );

    await connection.commit();

    res.json({ message: 'Tarea asignada con éxito' });

  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: 'Error al asignar tarea', details: err.message });
  } finally {
    connection.release();
  }
});

app.get('/pendientes', verify_token, authorize_roles(2), async function (req, res) {

  try {
    const [rows] = await pool.query(`SELECT
    procesos.nombreProceso,productos.nombreProducto,procesos.cantidadProducto,procesos.fechaEntrega
  FROM
    procesos
  JOIN
    productos ON procesos.idProducto = productos.idProducto
  WHERE
    procesos.estadoProducto = 'pendiente'
  ORDER BY
    procesos.fechaEntrega ASC
`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.get('/incidencias', verify_token, authorize_roles(2), async function (req, res) {

  try {
    const [rows] = await pool.query(`SELECT
    incidencias.idIncidencia,incidencias.descripcion,incidencias.fechaIncidencia,tiposIncidencias.tipoIncidencia,procesos.nombreProceso,puestos.nombrePuesto,empleados.nombreEmpleado,empleados.apellidoEmpleado
  FROM
    incidencias
  JOIN
    tiposIncidencias ON incidencias.idTipoIncidencia = tiposIncidencias.idTipoIncidencia
  JOIN
    procesos ON incidencias.idProceso = procesos.idProceso
  JOIN
    trabajos ON procesos.idProceso = trabajos.idProceso
  JOIN
    puestos ON trabajos.idPuesto = puestos.idPuesto
  JOIN
    empleados ON trabajos.idEmpleado = empleados.idEmpleado
  WHERE
    incidencias.vistaIncidencia = '0'
  ORDER BY
    incidencias.fechaIncidencia DESC
`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/logout', verify_token, authorize_roles(2), async function (req, res) {
  const { idUsuario } = req.body;

  try {
    // Aquí podrías registrar la salida del encargado si fuera necesario
    console.log(`Encargado con ID ${idUsuario} cerró sesión`);

    res.status(200).json({ message: 'Logout exitoso (encargado)' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cerrar sesión', details: err.message });
  }
});

app.get('/tipoincidencias', verify_token, authorize_roles(2), async function (req, res) {

  try {
    const [rows] = await pool.query(`SELECT * FROM tiposincidencias`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.post('/producto', verify_token, authorize_roles(2), async function (req, res) {

  try {
    const { nombreProducto } = req.body;
    const [rows] = await pool.query(`SELECT
      productos.nombreProducto,productos.tiempoProduccionEstimado,planos.nombrePlano,planos.urlPlano
      FROM productos
      JOIN planos ON productos.idProducto = planos.idProducto
      WHERE productos.nombreProducto = ?;
      `,[nombreProducto]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.post('/incidencia', verify_token, authorize_roles(2), async function (req, res) {
  try {
    const { idProceso, descripcion, idTipoIncidencia } = req.body;
    const [rows] = await pool.query(
      `INSERT INTO incidencias (idProceso, descripcion, idTipoIncidencia, fechaIncidencia, vistaIncidencia)
       VALUES (?, ?, ?, ?, ?)`,
      [idProceso, descripcion, idTipoIncidencia, new Date(), '1']
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/incidencias/:id', verify_token, authorize_roles(2), async function (req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `UPDATE incidencias SET vistaIncidencia = '1' WHERE idIncidencia = ?`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/incidencias/:id', verify_token, authorize_roles(2), async function (req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `DELETE FROM incidencias WHERE idIncidencia = ?`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/productos', verify_token, authorize_roles(2), async function (req, res) {
  try {
    const [rows] = await pool.query('SELECT idProducto,nombreProducto FROM productos');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/producto/:nombreProducto', verify_token, authorize_roles(2), async function (req, res) {
  try {
    const { nombreProducto } = req.params;
    const [rows] = await pool.query(
      `SELECT productos.nombreProducto, productos.tiempoProduccionEstimado, planos.nombrePlano, planos.urlPlano
       FROM productos
       JOIN planos ON productos.idProducto = planos.idProducto
       WHERE productos.nombreProducto = ?;`,
      [nombreProducto]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;