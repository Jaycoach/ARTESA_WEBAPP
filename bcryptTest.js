// bcryptTest.js
const bcrypt = require('bcrypt');

async function testBcrypt() {
    const testPassword = "NaIs2010";
    const storedHash = "$2b$10$kY0OBsAjiak45AEd336e2.JYYHzYmyj9M3JR4ZB6M4ZqEQbhQDQaK";

    console.log('Test de bcrypt:');
    console.log('---------------');
    console.log('Password a probar:', testPassword);
    console.log('Hash almacenado:', storedHash);
    console.log('Longitud del hash:', storedHash.length);

    try {
        // Generar un nuevo hash con la misma contraseña
        const newHash = await bcrypt.hash(testPassword, 10);
        console.log('\nNuevo hash generado:', newHash);
        console.log('Longitud del nuevo hash:', newHash.length);

        // Comparar la contraseña con el hash almacenado
        const isMatch = await bcrypt.compare(testPassword, storedHash);
        console.log('\nResultado de la comparación:', isMatch);

        // Verificar que el nuevo hash también funciona
        const isNewMatch = await bcrypt.compare(testPassword, newHash);
        console.log('Resultado con nuevo hash:', isNewMatch);
    } catch (error) {
        console.error('Error durante la prueba:', error);
    }
}

testBcrypt();