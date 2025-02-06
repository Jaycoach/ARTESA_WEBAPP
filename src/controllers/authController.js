const { createUser } = require('../models/userModel');

const registerUser = async (req, res) => {
    const { name, mail, password } = req.body;
    try {
        const user = await createUser(name, mail, password, 2); // 2 = rol de usuario regular
        res.status(201).json({ message: 'Usuario registrado', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    registerUser,
};