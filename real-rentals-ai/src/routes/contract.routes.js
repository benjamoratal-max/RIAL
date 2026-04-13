const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contract.controller');
// Usar el middleware de TypeScript compilado
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, contractController.getAllContracts);
router.get('/:id', contractController.getContractById);
router.post('/', contractController.createContract);
router.put('/:id', contractController.updateContract);
router.delete('/:id', contractController.deleteContract);

module.exports = router;