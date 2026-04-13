const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend funcionando correctamente!' });
});

// Ruta de propiedades de prueba
app.get('/api/properties', (req, res) => {
  res.json([
    {
      id: 1,
      title: 'Apartamento Moderno en el Centro',
      description: 'Hermoso apartamento de 2 habitaciones en el centro de la ciudad',
      price: 1200,
      location: 'Centro de la Ciudad',
      images: ['https://via.placeholder.com/400x300'],
      isAvailable: true
    },
    {
      id: 2,
      title: 'Casa con Jardín',
      description: 'Casa familiar de 3 habitaciones con jardín privado',
      price: 1800,
      location: 'Zona Residencial',
      images: ['https://via.placeholder.com/400x300'],
      isAvailable: true
    }
  ]);
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor de prueba corriendo en http://localhost:${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}/api/test`);
  console.log(`🏠 Propiedades disponibles en http://localhost:${PORT}/api/properties`);
});
