const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener todas las propiedades
const getAllListings = async (req, res) => {
  try {
    const listings = await prisma.listing.findMany();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener propiedades' });
  }
};

// Obtener una propiedad por ID
const getListingById = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener la propiedad' });
  }
};

// Crear una nueva propiedad
const createListing = async (req, res) => {
  const data = req.body;
  try {
    const newListing = await prisma.listing.create({ data });
    res.status(201).json(newListing);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la propiedad' });
  }
};

// Editar una propiedad
const updateListing = async (req, res) => {
  const id = parseInt(req.params.id);
  const data = req.body;
  try {
    const updated = await prisma.listing.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar la propiedad' });
  }
};

// Eliminar una propiedad
const deleteListing = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.listing.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar la propiedad' });
  }
};

module.exports = {
  getAllListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
};