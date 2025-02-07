const { createUser } = require('../models/userModel');

const registerUser = async (req, res) => {
    console.log(req.body); // Verifica si password está presente
    const { name, mail, password } = req.body;
    if (!name || !mail || !password) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }
    try {
        const user = await createUser(name, mail, password, 2);
        res.status(201).json({ message: 'Usuario registrado', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    registerUser,
};