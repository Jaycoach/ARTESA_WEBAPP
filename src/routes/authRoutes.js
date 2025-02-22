const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authValidators = require('../validators/authValidators');
const { sanitizeBody } = require('../middleware/security');

// Registro de usuario
router.post(
  '/register',
  sanitizeBody,
  authValidators.validateName,
  authValidators.validateEmail,
  authValidators.validatePassword,
  authController.registerUser
);

// Login de usuario
router.post(
  '/login',
  sanitizeBody,
  authValidators.validateEmail,
  authValidators.validatePassword,
  authValidators.validateLoginAttempts,
  authController.loginUser
);

module.exports = router;