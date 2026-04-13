const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener todos los contratos
const getAllContracts = async (req, res) => {
  try {
    const contracts = await prisma.contract.findMany({
      include: { user: true, listing: true },
    });
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
};

// Obtener un contrato por ID
const getContractById = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { user: true, listing: true },
    });
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el contrato' });
  }
};

// Crear un nuevo contrato
const createContract = async (req, res) => {
  const data = req.body;
  try {
    const newContract = await prisma.contract.create({ data });
    res.status(201).json(newContract);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear el contrato' });
  }
};

// Editar un contrato
const updateContract = async (req, res) => {
  const id = parseInt(req.params.id);
  const data = req.body;
  try {
    const updated = await prisma.contract.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el contrato' });
  }
};

// Eliminar un contrato
const deleteContract = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.contract.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el contrato' });
  }
};

module.exports = {
  getAllContracts,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
};