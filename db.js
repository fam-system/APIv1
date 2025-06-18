const mysql = require('mysql2/promise');

/*const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'admin', // tu contraseña
  database: 'tpiprog3', // el nombre de tu base
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});*/

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS, // tu contraseña
  database: process.env.DB_NAME, // el nombre de tu base
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
