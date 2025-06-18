const express = require('express');
const bcrypt = require('bcrypt');

const pool = require('../db');
const app = express.Router();

const {verify_token, authorize_roles} = require('../middleware/auth_middleware');

app.get('/roles', verify_token, authorize_roles(3), async function (req, res) {
  
  try {
    const [rows] = await pool.query(`SELECT * FROM roles`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

//, verify_token, authorize_roles('oficina')
app.post('/newempleado', verify_token, authorize_roles(3), async function (req, res) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const { nombreEmpleado,apellidoEmpleado,dniEmpleado,direccionEmpleado,telefonoEmpleado,nombreUsuario,pass, idRol } = req.body;
    
    if (!nombreUsuario || !pass || !nombreEmpleado || !apellidoEmpleado || !dniEmpleado) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }
    
    const [existingRows] = await connection.query(`SELECT * FROM empleados WHERE dniEmpleado = ?`, [dniEmpleado]);
    
    if (existingRows.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Ya existe un empleado con ese DNI' });
    }

    const [existingUserRows] = await connection.query(`SELECT * FROM usuarios WHERE nombreUsuario = ?`, [nombreUsuario]);
    if (existingUserRows.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Ya existe un usuario con ese nombre de usuario' });
    }

    const [rows] = await connection.query(`INSERT INTO empleados 
      (nombreEmpleado, apellidoEmpleado, dniEmpleado, direccionEmpleado, telefonoEmpleado, fechaIngreso, estadoEmpleado, bajaEmpleado)
      VALUES (?, ?, ?, ?, ?, NOW(), 0, 0)`, 
      [nombreEmpleado, apellidoEmpleado, dniEmpleado, direccionEmpleado, telefonoEmpleado]);

        const saltRounds = 12;
    const hash = await bcrypt.hash(pass, saltRounds);
          
    await connection.query(`INSERT INTO usuarios 
        (nombreUsuario, pass, idEmpleado, idRol) 
        VALUES (?, ?, ?, ?)`, [nombreUsuario, hash, rows.insertId, idRol]);
    // Si todo sale bien, confirmar la transacción
    await connection.commit();
    connection.release();
    
    res.json({ message: 'Empleado y usuario creados exitosamente', idEmpleado: rows.insertId });
    
  } catch (err) {
    // Si hay algún error, deshacer la transacción
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: err.message });
  }

});

app.get('/producto', verify_token, authorize_roles(3), async function (req, res) {
  
  try {
    const [rows] = await pool.query(`SELECT 
      productos.idProducto,productos.nombreProducto 
      FROM productos`,  
      []);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.post('/productos', verify_token, authorize_roles(3), async function (req, res) {
  const { nombreProducto,tiempoProduccionEstimado } = req.body;
  try {222
    const [rows] = await pool.query(`INSERT INTO productos
      (nombreProducto, tiempoProduccionEstimado)
      VALUES (?, ?)`,
      [ nombreProducto, tiempoProduccionEstimado ]);
    res.json({ message: 'Producto creado exitosamente', nombreProducto, idProducto: rows.insertId});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

//codigo de gonza
app.post('/proceso', verify_token, authorize_roles(3), async function (req, res) {
  const { nombreProceso, idProducto, cantidadProducto, fechaEntrega } = req.body;

  try {
    const [rows] = await pool.query(`
      INSERT INTO procesos (nombreProceso, idProducto, cantidadProducto, estadoProducto, fechaEntrega)
      VALUES (?, ?, ?, 'pendiente', ?)
    `, [nombreProceso, idProducto, cantidadProducto, fechaEntrega]);

    res.json({ message: 'Proceso creado exitosamente', idProceso: rows.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/incidencias/nuevas', verify_token, async (req, res) => {
  const [rows] = await pool.query(`SELECT
  incidencias.idIncidencia,
  tiposIncidencias.tipoIncidencia,
  productos.nombreProducto,
  incidencias.descripcion,
  incidencias.fechaIncidencia
FROM incidencias
JOIN tiposIncidencias ON incidencias.idTipoIncidencia = tiposIncidencias.idTipoIncidencia
LEFT JOIN procesos ON incidencias.idProceso = procesos.idProceso
LEFT JOIN productos ON procesos.idProducto = productos.idProducto
WHERE
  incidencias.vistaIncidencia = 1
  OR (incidencias.vistaIncidencia = 1 AND incidencias.idProceso IS NULL);`);
  res.json(rows);
});

app.post('/incidencias/:id/vista', async (req, res) => {
  const { id } = req.params;  // <-- así accedés al parámetro :id
  try {
    const [result] = await pool.query(
      "UPDATE incidencias SET vistaIncidencia = 1 WHERE idIncidencia = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Incidencia no encontrada" });
    }

    res.json({ message: "Incidencia marcada como vista" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

//aca termina el codigo de gonza
app.get('/procesos', verify_token, authorize_roles(3), async function (req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        procesos.idProceso,
        procesos.nombreProceso,
        procesos.estadoProducto,
        puestos.nombrePuesto,
        empleados.nombreEmpleado,
        empleados.apellidoEmpleado
      FROM procesos
      LEFT JOIN productos ON procesos.idProducto = productos.idProducto
      LEFT JOIN trabajos ON procesos.idProceso = trabajos.idProceso
      LEFT JOIN empleados ON trabajos.idEmpleado = empleados.idEmpleado
      LEFT JOIN puestos ON trabajos.idPuesto = puestos.idPuesto
      WHERE procesos.estadoProducto != 'terminado'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


  app.post('/productos', verify_token, authorize_roles(3), async function (req, res) {
  const { nombreProducto,tiempoProduccionEstimado } = req.body;
  try {222
    const [rows] = await pool.query(`INSERT INTO productos
      (nombreProducto, tiempoProduccionEstimado)
      VALUES (?, ?)`,
      [ nombreProducto, tiempoProduccionEstimado ]);
    res.json({ message: 'Producto creado exitosamente', idProducto: rows.insertId});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.post('/planos', verify_token, authorize_roles(3), async function (req, res) {
  const { idProducto,nombrePlano,urlPlano } = req.body;
  try {
    const [rows] = await pool.query(`INSERT INTO planos
      (idProducto, nombrePlano, urlPlano)
      VALUES (?, ?, ?)`,
      [ idProducto, nombrePlano, urlPlano ]);
    res.json({ message: 'Plano creado exitosamente', idPlano: rows.insertId });
    //res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

  });

  app.get('/planos/:id', verify_token, authorize_roles(3), async function (req, res) {
    try {
      const { id } = req.params;
      const [rows] = await pool.query(`
        SELECT * FROM planos
        WHERE idProducto = ?
      `, [id]);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

    app.get('/empleados', async (req, res) => {
    try {
      const [empleados] = await pool.query(`
        SELECT 
          idEmpleado, 
          CONCAT(apellidoEmpleado, ' ', nombreEmpleado) AS nombreCompleto 
        FROM empleados
        ORDER BY apellidoEmpleado, nombreEmpleado
      `);
  
      res.json(empleados);
    } catch (error) {
      console.error('Error al obtener empleados:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

    app.post('/informes/proceso', verify_token, authorize_roles(3), async function (req, res) {
    const { idProceso } = req.body;
  
    if (!idProceso) {
      return res.status(400).json({ error: 'Falta el idProceso en el cuerpo del pedido' });
    }
  
    try {
      const [rows] = await pool.query(`
        SELECT *
        FROM vista_informe_proceso_detallado
        WHERE Numero = ?
      `, [idProceso]);
  
      if (rows.length === 0) {
        return res.status(404).json({ error: 'No se encontró el proceso solicitado' });
      }
  
      res.json(rows[0]); // Devuelve solo el objeto si hay un único resultado
    } catch (err) {
      console.error('Error al consultar el informe:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  app.delete('/planos/:id', verify_token, authorize_roles(3), async function (req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(`DELETE FROM planos WHERE idPlano = ?`, [id]);
  
      const [deleteResult] = result;
  
      if (deleteResult.affectedRows === 0) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
      }
  
      res.json({ mensaje: 'Archivo eliminado correctamente' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/informes',verify_token, authorize_roles(3), async function (req, res)  {
    const { empleado, desde, hasta } = req.body;
    if (!empleado || !desde || !hasta) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
  
    try {
      const [rows] = await pool.query(`
        SELECT *
        FROM vista_informe_produccion_empleado
        WHERE CONCAT(apellidoEmpleado, ' ', nombreEmpleado) = ?
          AND (fechaFin BETWEEN ? AND ? OR fechaFin IS NULL)
      `, [empleado, desde, hasta]);
  
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });


module.exports = app;

/*const express = require('express');
const bcrypt = require('bcrypt');

const pool = require('../db');
const app = express.Router();

const {verify_token, authorize_roles} = require('../middleware/auth_middleware');

app.get('/roles', verify_token, authorize_roles(3), async function (req, res) {
  
  try {
    const [rows] = await pool.query(`SELECT * FROM roles`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

//, verify_token, authorize_roles('oficina')
app.post('/newempleado', verify_token, authorize_roles(3), async function (req, res) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const { nombreEmpleado,apellidoEmpleado,dniEmpleado,direccionEmpleado,telefonoEmpleado,nombreUsuario,pass, idRol } = req.body;
    
    if (!nombreUsuario || !pass || !nombreEmpleado || !apellidoEmpleado || !dniEmpleado) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }
    
    const [existingRows] = await connection.query(`SELECT * FROM empleados WHERE dniEmpleado = ?`, [dniEmpleado]);
    
    if (existingRows.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Ya existe un empleado con ese DNI' });
    }

    const [existingUserRows] = await connection.query(`SELECT * FROM usuarios WHERE nombreUsuario = ?`, [nombreUsuario]);
    if (existingUserRows.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Ya existe un usuario con ese nombre de usuario' });
    }

    const [rows] = await connection.query(`INSERT INTO empleados 
      (nombreEmpleado, apellidoEmpleado, dniEmpleado, direccionEmpleado, telefonoEmpleado, fechaIngreso, estadoEmpleado, bajaEmpleado)
      VALUES (?, ?, ?, ?, ?, NOW(), 0, 0)`, 
      [nombreEmpleado, apellidoEmpleado, dniEmpleado, direccionEmpleado, telefonoEmpleado]);

        const saltRounds = 12;
    const hash = await bcrypt.hash(pass, saltRounds);
          
    await connection.query(`INSERT INTO usuarios 
        (nombreUsuario, pass, idEmpleado, idRol) 
        VALUES (?, ?, ?, ?)`, [nombreUsuario, hash, rows.insertId, idRol]);
    // Si todo sale bien, confirmar la transacción
    await connection.commit();
    connection.release();
    
    res.json({ message: 'Empleado y usuario creados exitosamente', idEmpleado: rows.insertId });
    
  } catch (err) {
    // Si hay algún error, deshacer la transacción
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: err.message });
  }

});

app.get('/producto', verify_token, authorize_roles(3), async function (req, res) {
  
  try {
    const [rows] = await pool.query(`SELECT 
      productos.idProducto,productos.nombreProducto 
      FROM productos`,  
      []);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});


//codigo de gonza
app.post('/proceso', verify_token, authorize_roles(3), async function (req, res) {
  const { nombreProceso, idProducto, cantidadProducto, fechaEntrega } = req.body;

  try {
    const [rows] = await pool.query(`
      INSERT INTO procesos (nombreProceso, idProducto, cantidadProducto, estadoProducto, fechaEntrega)
      VALUES (?, ?, ?, 'pendiente', ?)
    `, [nombreProceso, idProducto, cantidadProducto, fechaEntrega]);

    res.json({ message: 'Proceso creado exitosamente', idProceso: rows.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/incidencias/nuevas', verify_token, async (req, res) => {
  const [rows] = await pool.query(`SELECT 
    incidencias.idIncidencia,
    tiposIncidencias.tipoIncidencia,
    productos.nombreProducto,
    incidencias.descripcion,
    incidencias.fechaIncidencia
    FROM incidencias
    JOIN tiposIncidencias ON incidencias.idTipoIncidencia = tiposIncidencias.idTipoIncidencia
    JOIN procesos ON incidencias.idProceso = procesos.idProceso
    JOIN productos ON procesos.idProducto = productos.idProducto
    WHERE incidencias.vistaIncidencia = 0;`);
  res.json(rows);
});

app.post('/incidencias/:id/vista', async (req, res) => {
  const { id } = req.params;  // <-- así accedés al parámetro :id
  try {
    const [result] = await pool.query(
      "UPDATE incidencias SET vistaIncidencia = 1 WHERE idIncidencia = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Incidencia no encontrada" });
    }

    res.json({ message: "Incidencia marcada como vista" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

//aca termina el codigo de gonza
app.get('/procesos', verify_token, authorize_roles(3), async function (req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        procesos.idProceso,
        procesos.nombreProceso, 
        procesos.estadoProducto, 
        puestos.nombrePuesto,
        empleados.nombreEmpleado, 
        empleados.apellidoEmpleado
      FROM procesos
      LEFT JOIN productos ON procesos.idProducto = productos.idProducto
      LEFT JOIN trabajos ON procesos.idProceso = trabajos.idProceso
      LEFT JOIN empleados ON trabajos.idEmpleado = empleados.idEmpleado
      LEFT JOIN puestos ON trabajos.idPuesto = puestos.idPuesto
      WHERE procesos.estadoProducto != 'terminado'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


  app.post('/productos', verify_token, authorize_roles(3), async function (req, res) {
  const { nombreProducto,tiempoProduccionEstimado } = req.body;
  try {222
    const [rows] = await pool.query(`INSERT INTO productos
      (nombreProducto, tiempoProduccionEstimado)
      VALUES (?, ?)`,  
      [ nombreProducto, tiempoProduccionEstimado ]);
    res.json({ message: 'Producto creado exitosamente', nombreProducto, idProducto: rows.insertId});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.post('/planos', verify_token, authorize_roles(3), async function (req, res) {
  const { idProducto,nombrePlano,urlPlano } = req.body;
  try {
    const [rows] = await pool.query(`INSERT INTO planos
      (idProducto, nombrePlano, urlPlano)
      VALUES (?, ?, ?)`,  
      [ idProducto, nombrePlano, urlPlano ]);
    res.json({ message: 'Plano creado exitosamente', idPlano: rows.insertId });
    //res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

  });

  app.get('/planos/:id', verify_token, authorize_roles(3), async function (req, res) {
    try {
      const { id } = req.params;
      const [rows] = await pool.query(`
        SELECT * FROM planos
        WHERE idProducto = ?
      `, [id]);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/planos/:id', verify_token, authorize_roles(3), async function (req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(`DELETE FROM planos WHERE idPlano = ?`, [id]);
  
      const [deleteResult] = result;
  
      if (deleteResult.affectedRows === 0) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
      }
  
      res.json({ mensaje: 'Archivo eliminado correctamente' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/informes',verify_token, authorize_roles(3), async function (req, res)  {
    const { empleado, desde, hasta } = req.body;
    if (!empleado || !desde || !hasta) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
  
    try {
      const [rows] = await pool.query(`
        SELECT *
        FROM vista_informe_produccion_empleado
        WHERE CONCAT(apellidoEmpleado, ' ', nombreEmpleado) = ?
          AND (fechaFin BETWEEN ? AND ? OR fechaFin IS NULL)
      `, [empleado, desde, hasta]);
  
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  app.get('/empleados', async (req, res) => {
    try {
      const [empleados] = await pool.query(`
        SELECT 
          idEmpleado, 
          CONCAT(apellidoEmpleado, ' ', nombreEmpleado) AS nombreCompleto 
        FROM empleados
        ORDER BY apellidoEmpleado, nombreEmpleado
      `);
  
      res.json(empleados);
    } catch (error) {
      console.error('Error al obtener empleados:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  app.post('/informes/proceso', verify_token, authorize_roles(3), async function (req, res) {
    const { idProceso } = req.body;
  
    if (!idProceso) {
      return res.status(400).json({ error: 'Falta el idProceso en el cuerpo del pedido' });
    }
  
    try {
      const [rows] = await pool.query(`
        SELECT *
        FROM vista_informe_proceso_detallado
        WHERE Numero = ?
      `, [idProceso]);
  
      if (rows.length === 0) {
        return res.status(404).json({ error: 'No se encontró el proceso solicitado' });
      }
  
      res.json(rows[0]); // Devuelve solo el objeto si hay un único resultado
    } catch (err) {
      console.error('Error al consultar el informe:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

module.exports = app;*/