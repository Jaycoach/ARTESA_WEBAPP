// test-email-diagnosis.js
require('dotenv').config();
const pool = require('./src/config/db');
const emailService = require('./src/services/EmailService');
const { createContextLogger } = require('./src/config/logger');

const logger = createContextLogger('EmailDiagnosis');

async function runDiagnosis() {
    console.log('🔍 === DIAGNÓSTICO COMPLETO DE EMAIL ===\n');
    
    try {
        // 1. Verificar configuración ENV
        console.log('📋 1. CONFIGURACIÓN DE VARIABLES DE ENTORNO:');
        console.log('SMTP_HOST:', process.env.SMTP_HOST);
        console.log('SMTP_PORT:', process.env.SMTP_PORT);
        console.log('SMTP_USER:', process.env.SMTP_USER);
        console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***CONFIGURADO***' : '❌ NO CONFIGURADO');
        console.log('SMTP_FROM:', process.env.SMTP_FROM);
        console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
        console.log('');

        // 2. Verificar conexión SMTP
        console.log('🔌 2. VERIFICANDO CONEXIÓN SMTP:');
        try {
            await emailService.verifyConnection();
            console.log('✅ Conexión SMTP exitosa');
        } catch (error) {
            console.log('❌ Error de conexión SMTP:', error.message);
            return;
        }
        console.log('');

        // 3. Verificar estado de la sucursal
        console.log('🏢 3. VERIFICANDO ESTADO DE SUCURSAL:');
        const branchEmail = 'lukopay@gmail.com';
        
        const { rows: branchRows } = await pool.query(
            `SELECT 
                branch_id, 
                branch_name, 
                email_branch, 
                password,
                is_login_enabled,
                email_verified,
                verification_token,
                verification_expires,
                client_id,
                created_at,
                updated_at
             FROM client_branches 
             WHERE email_branch = $1`,
            [branchEmail]
        );

        if (branchRows.length === 0) {
            console.log('❌ No se encontró sucursal con email:', branchEmail);
            return;
        }

        const branch = branchRows[0];
        console.log('Sucursal encontrada:');
        console.log('  - ID:', branch.branch_id);
        console.log('  - Nombre:', branch.branch_name);
        console.log('  - Email:', branch.email_branch);
        console.log('  - Tiene contraseña:', !!branch.password);
        console.log('  - Login habilitado:', branch.is_login_enabled);
        console.log('  - Email verificado:', branch.email_verified);
        console.log('  - Token actual:', branch.verification_token ? 'Existe' : 'No existe');
        console.log('  - Token expira:', branch.verification_expires);
        console.log('');

        // 4. Si login está deshabilitado, habilitarlo temporalmente
        if (!branch.is_login_enabled) {
            console.log('⚠️  4. LOGIN ESTÁ DESHABILITADO - HABILITANDO TEMPORALMENTE:');
            await pool.query(
                'UPDATE client_branches SET is_login_enabled = true WHERE branch_id = $1',
                [branch.branch_id]
            );
            console.log('✅ Login habilitado temporalmente para pruebas');
            console.log('');
        }

        // 5. Generar nuevo token
        console.log('🔑 5. GENERANDO NUEVO TOKEN DE VERIFICACIÓN:');
        const crypto = require('crypto');
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        await pool.query(
            'UPDATE client_branches SET verification_token = $1, verification_expires = $2 WHERE branch_id = $3',
            [verificationToken, verificationExpires, branch.branch_id]
        );
        
        console.log('✅ Token generado:', verificationToken);
        console.log('✅ Expira:', verificationExpires);
        console.log('');

        // 6. Intentar enviar correo de prueba
        console.log('📧 6. ENVIANDO CORREO DE VERIFICACIÓN:');
        try {
            const result = await emailService.sendBranchVerificationEmail(
                branchEmail,
                verificationToken,
                branch.branch_name
            );
            
            console.log('✅ Correo enviado exitosamente');
            console.log('  - Message ID:', result.messageId);
            console.log('  - Response:', result.response);
            console.log('  - URL de verificación generada:', `${process.env.FRONTEND_URL}/branch-verify-email/${verificationToken}`);
            
        } catch (emailError) {
            console.log('❌ Error enviando correo:', emailError.message);
            console.log('Stack:', emailError.stack);
        }
        console.log('');

        // 7. Verificar que el token se guardó correctamente
        console.log('🔍 7. VERIFICANDO TOKEN EN BASE DE DATOS:');
        const { rows: verifyRows } = await pool.query(
            'SELECT verification_token, verification_expires FROM client_branches WHERE branch_id = $1',
            [branch.branch_id]
        );
        
        if (verifyRows.length > 0) {
            console.log('✅ Token en BD:', verifyRows[0].verification_token);
            console.log('✅ Expira en BD:', verifyRows[0].verification_expires);
        }
        
        console.log('\n🎯 === DIAGNÓSTICO COMPLETO ===');
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

// Ejecutar diagnóstico
runDiagnosis();