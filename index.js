const express = require('express');
const fs = require('fs');
const cors = require('cors');

const operarioRouter = require('./routes/operario');
const encargadoRouter = require('./routes/encargado');
const oficinaRouter = require('./routes/oficina');
const adminRouter = require('./routes/administrador');
const loginRouter = require('./routes/ingreso');

const configContent = fs.readFileSync('config.json');
const config = JSON.parse(configContent);
const PORT = process.env.PORT || 3000;
//const port = config.port || 3000;
config.version = '1.2.5';



const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/operario', operarioRouter);
app.use('/encargado', encargadoRouter);
app.use('/oficina', oficinaRouter);
//app.use('/administrador', adminRoutes);
app.use('/ingreso', loginRouter);

// Ruta Principal
app.get('/', (req, res) => {
  res.json({
    info: 'ok',
    status: true,
    message: 'home publica',
    timestamp: new Date().toISOString()
  });
});

//app.listen(port, () => {
//  console.log(`Servidor en Puerto ${port}`);
//});
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
