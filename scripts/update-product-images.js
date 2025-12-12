/**
 * Script para actualización masiva de imágenes de productos
 * Convierte URLs de Google Drive a URLs de descarga directa
 * y actualiza la base de datos
 * 
 * Uso: node scripts/update-product-images.js [--dry-run]
 * --dry-run: Muestra los cambios sin aplicarlos
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 5432
});

// Modo de simulación (no aplica cambios)
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Logger simple para el script
 */
const logger = {
  info: (message, data) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ℹ️  ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  warn: (message, data) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠️  ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message, data) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  debug: (message, data) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] 🔍 ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }
};

/**
 * Convierte URL de Google Drive de formato compartido a descarga directa
 * De: https://drive.google.com/file/d/FILE_ID/view?usp=drive_link
 * A: https://drive.google.com/uc?export=view&id=FILE_ID
 */
function convertGoogleDriveUrl(url) {
  try {
    const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    logger.warn('No se pudo extraer ID del archivo', { url });
    return url;
  } catch (error) {
    logger.error('Error al convertir URL', { url, error: error.message });
    return url;
  }
}

// Mapeo de códigos SAP a URLs de Google Drive
const productImages = {
  'PANPT24': 'https://drive.google.com/file/d/1mEPrfcij1lyG_FcyKPtOYdTPNaQimME4/view?usp=drive_link',
  'PANPT23': 'https://drive.google.com/file/d/1mEPrfcij1lyG_FcyKPtOYdTPNaQimME4/view?usp=drive_link',
  'PANPT07': 'https://drive.google.com/file/d/1iIq07WCQRmRxfN8GVCSQhnKbS_U9myUq/view?usp=drive_link',
  'PANPT06': 'https://drive.google.com/file/d/1iIq07WCQRmRxfN8GVCSQhnKbS_U9myUq/view?usp=drive_link',
  'PANPT68': 'https://drive.google.com/file/d/1Zo9D8wc1XrH-PmatoN07aSnpk5SpQ4xC/view?usp=drive_link',
  'PANPT05': 'https://drive.google.com/file/d/1iIq07WCQRmRxfN8GVCSQhnKbS_U9myUq/view?usp=drive_link',
  'PANPT04': 'https://drive.google.com/file/d/1iIq07WCQRmRxfN8GVCSQhnKbS_U9myUq/view?usp=drive_link',
  'PANPT14': 'https://drive.google.com/file/d/15-6BeU28gb9e6cpRTsUFahRdUdtbs5xz/view?usp=drive_link',
  'PANPT15': 'https://drive.google.com/file/d/15-6BeU28gb9e6cpRTsUFahRdUdtbs5xz/view?usp=drive_link',
  'PANPT03': 'https://drive.google.com/file/d/1Zo9D8wc1XrH-PmatoN07aSnpk5SpQ4xC/view?usp=drive_link',
  'PANPT10': 'https://drive.google.com/file/d/1Zo9D8wc1XrH-PmatoN07aSnpk5SpQ4xC/view?usp=drive_link',
  'PANPT70': 'https://drive.google.com/file/d/1KEmRMNw6a2HqX0fbd58pu1EQse8gNJXY/view?usp=drive_link',
  'PANPT72': 'https://drive.google.com/file/d/1KEmRMNw6a2HqX0fbd58pu1EQse8gNJXY/view?usp=drive_link',
  'PANPT69': 'https://drive.google.com/file/d/1KEmRMNw6a2HqX0fbd58pu1EQse8gNJXY/view?usp=drive_link',
  'PANPT67': 'https://drive.google.com/file/d/1uC8xdLyLZjudxaBRlcWmfHobP9AxpMpo/view?usp=drive_link',
  'PANPT29': 'https://drive.google.com/file/d/1-6BQQTQcY6DJjrg24ED2k9-bn4pB5zLD/view?usp=drive_link',
  'PANPT28': 'https://drive.google.com/file/d/1-6BQQTQcY6DJjrg24ED2k9-bn4pB5zLD/view?usp=drive_link',
  'PANPT12': 'https://drive.google.com/file/d/1v-8t2mMfm5GPuPE3EwSVCt9HndY6SIaB/view?usp=drive_link',
  'PANPT09': 'https://drive.google.com/file/d/1QdcyST1Qt9IK2U660HKtwDXhEi-ZSfa_/view?usp=drive_link',
  'PANPT73': 'https://drive.google.com/file/d/1t7mq_-SoIvOYaXBZBm6AEaBLUsv6mmMT/view?usp=drive_link',
  'PANPT18': 'https://drive.google.com/file/d/1sUbeJfuKm3yFbStnZfJNfrPC8HWZ5CFr/view?usp=drive_link',
  'PANPT17': 'https://drive.google.com/file/d/1sUbeJfuKm3yFbStnZfJNfrPC8HWZ5CFr/view?usp=drive_link',
  'PANPT19': 'https://drive.google.com/file/d/1loveUAf5hSObirXemU8teyivAy9wWhOs/view?usp=drive_link',
  'PANPT01': 'https://drive.google.com/file/d/183QucYZYhG_5tqRLNMgX8yjSznB35uON/view?usp=drive_link',
  'PANPT71': 'https://drive.google.com/file/d/1sUbeJfuKm3yFbStnZfJNfrPC8HWZ5CFr/view?usp=drive_link',
  'PANPT16': 'https://drive.google.com/file/d/1sUbeJfuKm3yFbStnZfJNfrPC8HWZ5CFr/view?usp=drive_link',
  'PANPT22': 'https://drive.google.com/file/d/183QucYZYhG_5tqRLNMgX8yjSznB35uON/view?usp=drive_link',
  'PANPT21': 'https://drive.google.com/file/d/183QucYZYhG_5tqRLNMgX8yjSznB35uON/view?usp=drive_link',
  'PANPT74': 'https://drive.google.com/file/d/1GmrBYzEOj92qsxVfSmm2-lDCGjkmneiS/view?usp=drive_link',
  'PANPT33': 'https://drive.google.com/file/d/1DCltszPpl1Dq9QGxqC-O-JS0Eg4QmcxZ/view?usp=drive_link',
  'PANPT32': 'https://drive.google.com/file/d/1DCltszPpl1Dq9QGxqC-O-JS0Eg4QmcxZ/view?usp=drive_link',
  'PANPT31': 'https://drive.google.com/file/d/1DCltszPpl1Dq9QGxqC-O-JS0Eg4QmcxZ/view?usp=drive_link',
  'PANPT30': 'https://drive.google.com/file/d/1ybO82Mozbzq_tDIiMiO5YaAhJ_MCpAux/view?usp=drive_link',
  'PANPT38': 'https://drive.google.com/file/d/174_j1sen6nvXy7EZCq9h0Pg8rw3HLpjf/view?usp=drive_link',
  'PANPT37': 'https://drive.google.com/file/d/174_j1sen6nvXy7EZCq9h0Pg8rw3HLpjf/view?usp=drive_link',
  'PANPT35': 'https://drive.google.com/file/d/174_j1sen6nvXy7EZCq9h0Pg8rw3HLpjf/view?usp=drive_link',
  'PANPT39': 'https://drive.google.com/file/d/174_j1sen6nvXy7EZCq9h0Pg8rw3HLpjf/view?usp=drive_link',
  'PANPT161': 'https://drive.google.com/file/d/174_j1sen6nvXy7EZCq9h0Pg8rw3HLpjf/view?usp=drive_link',
  'PANPT42': 'https://drive.google.com/file/d/1FCaqaZShzox63ODV5Az0kZTIuH9veIra/view?usp=drive_link',
  'PANPT41': 'https://drive.google.com/file/d/1FCaqaZShzox63ODV5Az0kZTIuH9veIra/view?usp=drive_link',
  'PANPT40': 'https://drive.google.com/file/d/1FCaqaZShzox63ODV5Az0kZTIuH9veIra/view?usp=drive_link',
  'PANPT187': 'https://drive.google.com/file/d/1FpOctmQOohmGMnIsni0_LedAK_WvZP8k/view?usp=drive_link',
  'PANPT186': 'https://drive.google.com/file/d/1FpOctmQOohmGMnIsni0_LedAK_WvZP8k/view?usp=drive_link',
  'PANPT185': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT179': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT178': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT181': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT180': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT177': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT176': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT175': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT183': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT184': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT182': 'https://drive.google.com/file/d/1ih7LtKmsp6jVGrdblM-UrEGbRSMOi4Sh/view?usp=drive_link',
  'PANPT45': 'https://drive.google.com/file/d/1LyVWMZx0oJKxHfgihreECmrGcS0u0KMi/view?usp=drive_link',
  'PANPT46': 'https://drive.google.com/file/d/1LyVWMZx0oJKxHfgihreECmrGcS0u0KMi/view?usp=drive_link',
  'PANPT193': 'https://drive.google.com/file/d/1LyVWMZx0oJKxHfgihreECmrGcS0u0KMi/view?usp=drive_link',
  'PANPT51': 'https://drive.google.com/file/d/1bWHPkLFUcXg2z9JnjnzkVmzmphqIskDb/view?usp=drive_link',
  'PANPT50': 'https://drive.google.com/file/d/1bWHPkLFUcXg2z9JnjnzkVmzmphqIskDb/view?usp=drive_link',
  'PANPT53': 'https://drive.google.com/file/d/1Y4R_HB6S95XSkRta8OCgGSLn1ZKTNgRQ/view?usp=drive_link',
  'PANPT52': 'https://drive.google.com/file/d/1Y4R_HB6S95XSkRta8OCgGSLn1ZKTNgRQ/view?usp=drive_link',
  'PANPT54': 'https://drive.google.com/file/d/1Y4R_HB6S95XSkRta8OCgGSLn1ZKTNgRQ/view?usp=drive_link',
  'PANPT49': 'https://drive.google.com/file/d/1bWHPkLFUcXg2z9JnjnzkVmzmphqIskDb/view?usp=drive_link',
  'PANPT48': 'https://drive.google.com/file/d/1bWHPkLFUcXg2z9JnjnzkVmzmphqIskDb/view?usp=drive_link',
  'PANPT47': 'https://drive.google.com/file/d/1bWHPkLFUcXg2z9JnjnzkVmzmphqIskDb/view?usp=drive_link',
  'PANPT58': 'https://drive.google.com/file/d/1Q3raXKYFfztXQB6ydqbC0UEYzDJRnH6m/view?usp=drive_link',
  'PANPT57': 'https://drive.google.com/file/d/1Q3raXKYFfztXQB6ydqbC0UEYzDJRnH6m/view?usp=drive_link',
  'PANPT56': 'https://drive.google.com/file/d/1UybY1iBbYLLV2IU7YAb_CBUYqSxoWv4A/view?usp=drive_link',
  'PANPT61': 'https://drive.google.com/file/d/1M5WntXm6WiSql-pBRVp6FgtR5JaNpGCN/view?usp=drive_link',
  'PANPT60': 'https://drive.google.com/file/d/1uzQode6wSUEUxk1-8hKzb_nACdGoiisA/view?usp=drive_link',
  'PANPT59': 'https://drive.google.com/file/d/1uzQode6wSUEUxk1-8hKzb_nACdGoiisA/view?usp=drive_link',
  'PANPT65': 'https://drive.google.com/file/d/1BDv0cMibTd9pZbtxSbP3E_CkmZNAj3lO/view?usp=drive_link',
  'PANPT64': 'https://drive.google.com/file/d/1BDv0cMibTd9pZbtxSbP3E_CkmZNAj3lO/view?usp=drive_link',
  'PANPT66': 'https://drive.google.com/file/d/1V859CAPXbIkfoOz1DLZreGhlv8dBB-OB/view?usp=drive_link',
  'PANPT44': 'https://drive.google.com/file/d/1KWY4Uf38W-548ID8221D1Z1iHKcfMHEP/view?usp=drive_link',
  'PANPT43': 'https://drive.google.com/file/d/1KWY4Uf38W-548ID8221D1Z1iHKcfMHEP/view?usp=drive_link',
  'PANPT93': 'https://drive.google.com/file/d/15UYs5zaZc-tHvswrxzqKP_FkN0G2FAHs/view?usp=drive_link',
  'PANPT92': 'https://drive.google.com/file/d/15UYs5zaZc-tHvswrxzqKP_FkN0G2FAHs/view?usp=drive_link',
  'PANPT89': 'https://drive.google.com/file/d/15UYs5zaZc-tHvswrxzqKP_FkN0G2FAHs/view?usp=drive_link',
  'PANPT88': 'https://drive.google.com/file/d/15UYs5zaZc-tHvswrxzqKP_FkN0G2FAHs/view?usp=drive_link',
  'PANPT91': 'https://drive.google.com/file/d/15UYs5zaZc-tHvswrxzqKP_FkN0G2FAHs/view?usp=drive_link',
  'PANPT90': 'https://drive.google.com/file/d/15UYs5zaZc-tHvswrxzqKP_FkN0G2FAHs/view?usp=drive_link',
  'PANPT82': 'https://drive.google.com/file/d/1fE76rVVXpmMXWZzMwRo8IW3KpXHZiM9V/view?usp=drive_link',
  'PANPT81': 'https://drive.google.com/file/d/1fE76rVVXpmMXWZzMwRo8IW3KpXHZiM9V/view?usp=drive_link',
  'PANPT85': 'https://drive.google.com/file/d/1fE76rVVXpmMXWZzMwRo8IW3KpXHZiM9V/view?usp=drive_link',
  'PANPT86': 'https://drive.google.com/file/d/1fE76rVVXpmMXWZzMwRo8IW3KpXHZiM9V/view?usp=drive_link',
  'PANPT84': 'https://drive.google.com/file/d/1fE76rVVXpmMXWZzMwRo8IW3KpXHZiM9V/view?usp=drive_link',
  'PANPT80': 'https://drive.google.com/file/d/1fE76rVVXpmMXWZzMwRo8IW3KpXHZiM9V/view?usp=drive_link',
  'PANPT79': 'https://drive.google.com/file/d/1fE76rVVXpmMXWZzMwRo8IW3KpXHZiM9V/view?usp=drive_link',
  'PANPT77': 'https://drive.google.com/file/d/1fE76rVVXpmMXWZzMwRo8IW3KpXHZiM9V/view?usp=drive_link',
  'PANPT76': 'https://drive.google.com/file/d/1fE76rVVXpmMXWZzMwRo8IW3KpXHZiM9V/view?usp=drive_link',
  'PANPT75': 'https://drive.google.com/file/d/1fE76rVVXpmMXWZzMwRo8IW3KpXHZiM9V/view?usp=drive_link',
  'LAMPT02': 'https://drive.google.com/file/d/1aUz1BW1N-Yo18y0pHdxM-Ou5zk4eMEIq/view?usp=drive_link',
  'LAMPT01': 'https://drive.google.com/file/d/12xZakfK9l13UacnJPqG5WcVAQKPpaeOS/view?usp=drive_link',
  'PANPT99': 'https://drive.google.com/file/d/1MwLSg58itJ1RddXBwD6ibhzaLgtvkQj7/view?usp=drive_link',
  'PANPT98': 'https://drive.google.com/file/d/1MwLSg58itJ1RddXBwD6ibhzaLgtvkQj7/view?usp=drive_link',
  'PANPT97': 'https://drive.google.com/file/d/1MwLSg58itJ1RddXBwD6ibhzaLgtvkQj7/view?usp=drive_link',
  'PANPT100': 'https://drive.google.com/file/d/1MwLSg58itJ1RddXBwD6ibhzaLgtvkQj7/view?usp=drive_link',
  'PANPT95': 'https://drive.google.com/file/d/1vP2RDreo13TI6V-E81xqQaBWOCji5XU2/view?usp=drive_link',
  'PANPT94': 'https://drive.google.com/file/d/1vP2RDreo13TI6V-E81xqQaBWOCji5XU2/view?usp=drive_link',
  'PANPT110': 'https://drive.google.com/file/d/1_eZKzXOvmpbYbcUjZajXhaVn4KOpDl30/view?usp=drive_link',
  'PANPT109': 'https://drive.google.com/file/d/1YD4aPY_-52BjZfuKGbpDUU0Q-HM1bv3h/view?usp=drive_link',
  'PANPT113': 'https://drive.google.com/file/d/14k-awgkyzr9XWWhI-VWdlwktqbaztBBa/view?usp=drive_link',
  'PANPT112': 'https://drive.google.com/file/d/14k-awgkyzr9XWWhI-VWdlwktqbaztBBa/view?usp=drive_link',
  'PANPT111': 'https://drive.google.com/file/d/14k-awgkyzr9XWWhI-VWdlwktqbaztBBa/view?usp=drive_link',
  'PANPT115': 'https://drive.google.com/file/d/1Jsdhb3fDQiwRH4BQ_1VfUSNlNS8API_Y/view?usp=drive_link',
  'PANPT117': 'https://drive.google.com/file/d/1rgc88ndHqixd6z189iyMc_VCncoZgWAc/view?usp=drive_link',
  'PANPT118': 'https://drive.google.com/file/d/1wZ7nFV6JquWGbKI-HtS13BwZJuKZw-V0/view?usp=drive_link',
  'PANPT124': 'https://drive.google.com/file/d/1KdNOHBn778zka_usoArvLM27hZxydLHx/view?usp=drive_link',
  'PANPT123': 'https://drive.google.com/file/d/1QyxZGUq8TPF0Qu4UrOa8S8qXK0ef3HI3/view?usp=drive_link',
  'PANPT122': 'https://drive.google.com/file/d/1QyxZGUq8TPF0Qu4UrOa8S8qXK0ef3HI3/view?usp=drive_link',
  'PANPT120': 'https://drive.google.com/file/d/1Xj_2DPPr8MWe6jOoKvMrugVLDEp4ipTS/view?usp=drive_link',
  'PANPT119': 'https://drive.google.com/file/d/1Xj_2DPPr8MWe6jOoKvMrugVLDEp4ipTS/view?usp=drive_link',
  'PANPT121': 'https://drive.google.com/file/d/1Qhie8DFNYuVzei4Bfnl6B2nSi-r2hd41/view?usp=drive_link',
  'PANPT167': 'https://drive.google.com/file/d/1YfPyf7SXPmZJXU6cpnFA-P0M3wTH9Y8T/view?usp=drive_link',
  'PANPT166': 'https://drive.google.com/file/d/1YfPyf7SXPmZJXU6cpnFA-P0M3wTH9Y8T/view?usp=drive_link',
  'PANPT130': 'https://drive.google.com/file/d/1UzRE2NewQlhAaMVKWl75UMuLyqnhIMhf/view?usp=drive_link',
  'PANPT129': 'https://drive.google.com/file/d/1UzRE2NewQlhAaMVKWl75UMuLyqnhIMhf/view?usp=drive_link',
  'PANPT128': 'https://drive.google.com/file/d/1UzRE2NewQlhAaMVKWl75UMuLyqnhIMhf/view?usp=drive_link',
  'PANPT127': 'https://drive.google.com/file/d/1UzRE2NewQlhAaMVKWl75UMuLyqnhIMhf/view?usp=drive_link',
  'PANPT126': 'https://drive.google.com/file/d/1UzRE2NewQlhAaMVKWl75UMuLyqnhIMhf/view?usp=drive_link',
  'PANPT125': 'https://drive.google.com/file/d/1UzRE2NewQlhAaMVKWl75UMuLyqnhIMhf/view?usp=drive_link',
  'PANPT173': 'https://drive.google.com/file/d/1NxAvbdZ9UHa6Xv36kCZqBmjuF1_usgcU/view?usp=drive_link',
  'PANPT172': 'https://drive.google.com/file/d/1kBHLE1wWRNIJvTmLOqjHYte5Zb86SVym/view?usp=drive_link',
  'PANPT168': 'https://drive.google.com/file/d/1u2P0Z4UnUdirV96WEpusbOMU1IACCETB/view?usp=drive_link',
  'PANPT194': 'https://drive.google.com/file/d/1u2P0Z4UnUdirV96WEpusbOMU1IACCETB/view?usp=drive_link',
  'PANPT212': 'https://drive.google.com/file/d/1Rzld_tQs2V1PCsKJQREAYS6Za40v-mkw/view?usp=drive_link',
  'PANPT195': 'https://drive.google.com/file/d/1Rzld_tQs2V1PCsKJQREAYS6Za40v-mkw/view?usp=drive_link',
  'PANPT169': 'https://drive.google.com/file/d/1azmIpotI0a0D6m_U-WZ_gQH8aXI42Oxd/view?usp=drive_link',
  'PANPT196': 'https://drive.google.com/file/d/1azmIpotI0a0D6m_U-WZ_gQH8aXI42Oxd/view?usp=drive_link',
  'PANPT171': 'https://drive.google.com/file/d/1Xcj3HwQlYZWQ6CcLyZ3IAqfAtgRHvogn/view?usp=drive_link',
  'PANPT170': 'https://drive.google.com/file/d/1Xcj3HwQlYZWQ6CcLyZ3IAqfAtgRHvogn/view?usp=drive_link',
  'PANPT154': 'https://drive.google.com/file/d/1cZQDE-dWCYAlp4T4m3jq7gB0pPefJppy/view?usp=drive_link',
  'PANPT156': 'https://drive.google.com/file/d/1cZQDE-dWCYAlp4T4m3jq7gB0pPefJppy/view?usp=drive_link',
  'PANPT155': 'https://drive.google.com/file/d/1cZQDE-dWCYAlp4T4m3jq7gB0pPefJppy/view?usp=drive_link',
  'PANPT160': 'https://drive.google.com/file/d/1N9K7B-3qwNbOV1GjMRiT2iUPap3JhyMG/view?usp=drive_link',
  'PANPT158': 'https://drive.google.com/file/d/1dNe7zsc0ZgF75PMz8zMeSvx-Vbe3RkRB/view?usp=drive_link',
  'PANPT157': 'https://drive.google.com/file/d/1dNe7zsc0ZgF75PMz8zMeSvx-Vbe3RkRB/view?usp=drive_link',
  'PANPT152': 'https://drive.google.com/file/d/1u2jkVv5Nz_YZsajp-ttIW1H2IDEqLFbK/view?usp=drive_link',
  'PANPT151': 'https://drive.google.com/file/d/1u2jkVv5Nz_YZsajp-ttIW1H2IDEqLFbK/view?usp=drive_link',
  'PANPT150': 'https://drive.google.com/file/d/1u2jkVv5Nz_YZsajp-ttIW1H2IDEqLFbK/view?usp=drive_link',
  'PANPT146': 'https://drive.google.com/file/d/1u2jkVv5Nz_YZsajp-ttIW1H2IDEqLFbK/view?usp=drive_link',
  'PANPT149': 'https://drive.google.com/file/d/1u2jkVv5Nz_YZsajp-ttIW1H2IDEqLFbK/view?usp=drive_link',
  'PANPT147': 'https://drive.google.com/file/d/1u2jkVv5Nz_YZsajp-ttIW1H2IDEqLFbK/view?usp=drive_link',
  'PANPT148': 'https://drive.google.com/file/d/1u2jkVv5Nz_YZsajp-ttIW1H2IDEqLFbK/view?usp=drive_link',
  'PANPT135': 'https://drive.google.com/file/d/1V2KqvpQnu62uiex-FRvNfbKUZMLNmQxG/view?usp=drive_link',
  'PANPT134': 'https://drive.google.com/file/d/1V2KqvpQnu62uiex-FRvNfbKUZMLNmQxG/view?usp=drive_link',
  'PANPT133': 'https://drive.google.com/file/d/1V2KqvpQnu62uiex-FRvNfbKUZMLNmQxG/view?usp=drive_link',
  'PANPT144': 'https://drive.google.com/file/d/1Qc63vU99bJP62OSfCVl8vbtVKupXghu_/view?usp=drive_link',
  'PANPT139': 'https://drive.google.com/file/d/1Qc63vU99bJP62OSfCVl8vbtVKupXghu_/view?usp=drive_link',
  'PANPT141': 'https://drive.google.com/file/d/1Qc63vU99bJP62OSfCVl8vbtVKupXghu_/view?usp=drive_link',
  'PANPT140': 'https://drive.google.com/file/d/1Qc63vU99bJP62OSfCVl8vbtVKupXghu_/view?usp=drive_link',
  'PANPT143': 'https://drive.google.com/file/d/1Qc63vU99bJP62OSfCVl8vbtVKupXghu_/view?usp=drive_link',
  'PANPT138': 'https://drive.google.com/file/d/1Obz5Hg-vM1IVXW6SX45ZDQXx_0Lz-yw_/view?usp=drive_link',
  'PANPT142': 'https://drive.google.com/file/d/1Qc63vU99bJP62OSfCVl8vbtVKupXghu_/view?usp=drive_link',
  'PANPT137': 'https://drive.google.com/file/d/1Qc63vU99bJP62OSfCVl8vbtVKupXghu_/view?usp=drive_link',
  'PANPT136': 'https://drive.google.com/file/d/1Qc63vU99bJP62OSfCVl8vbtVKupXghu_/view?usp=drive_link',
  'PANPT106': 'https://drive.google.com/file/d/1jJrRlYrTC7Y2TjuGEIwDiK42EtOscJzn/view?usp=drive_link',
  'PANPT107': 'https://drive.google.com/file/d/1jJrRlYrTC7Y2TjuGEIwDiK42EtOscJzn/view?usp=drive_link',
  'PANPT163': 'https://drive.google.com/file/d/19_-x7nIaZZQ9V4Cyi_py2AMG8up7-d6h/view?usp=drive_link',
  'PANPT162': 'https://drive.google.com/file/d/1KNTuTqjATJE_AtSRxtalBzkEPQfFN63o/view?usp=drive_link',
  'PANPT164': 'https://drive.google.com/file/d/1yvvudVNHcVX1vPPsUVVPcSZiP6GmPW4l/view?usp=drive_link',
  'PASPT05': 'https://drive.google.com/file/d/1u3WgkrgtsYv8dZU8feiGf3L5Ugr7Bqm5/view?usp=drive_link',
  'PASPT11': 'https://drive.google.com/file/d/1hH0m6cbmZKfmdo6b0J_Ra5MpcTudqOnH/view?usp=drive_link',
  'PASPT01': 'https://drive.google.com/file/d/1p-jakMhwxNA1jv-FOMfNBzzfWk8VfWeT/view?usp=drive_link',
  'PASPT06': 'https://drive.google.com/file/d/1cwfyuJlnry2cG_rU_VCFX0tCOo_tuARW/view?usp=drive_link',
  'PASPT10': 'https://drive.google.com/file/d/1kX7e-yKwpQ_z-oYHELu68XHgVYeOJtk3/view?usp=drive_link',
  'PASPT07': 'https://drive.google.com/file/d/1kX7e-yKwpQ_z-oYHELu68XHgVYeOJtk3/view?usp=drive_link',
  'PASPT02': 'https://drive.google.com/file/d/1P4ifHXGBVoOPfTFmFQKa0KPPszdsXkMF/view?usp=drive_link',
  'PASPT04': 'https://drive.google.com/file/d/1lOa_t97ceyMJNESaKn9V9Kb8UDUo4i6h/view?usp=drive_link',
  'PASPT09': 'https://drive.google.com/file/d/11IVNL4lcM17Yy-akT1OFXkJAttMYO1Uk/view?usp=drive_link',
  'PASPT03': 'https://drive.google.com/file/d/1gXoNNAuM8EyDUB89mHssT2_y4DNlTx9O/view?usp=drive_link',
  'GTAPT01': 'https://drive.google.com/file/d/1CRYbHeuw59_a5B0voYcdh6V6-lQnzyAS/view?usp=drive_link',
  'GTAPT02': 'https://drive.google.com/file/d/1vkjxHGLIzjABhPb5_sm4dZglB2AHJ9Yd/view?usp=drive_link',
  'GTAPT03': 'https://drive.google.com/file/d/1jnnNPd-I80xLSKfS-Bd3WCn3IXHu-vRN/view?usp=drive_link',
  'GTAPT04': 'https://drive.google.com/file/d/181EA74-l1DBOODOx2sir9dFlOOtg0jNK/view?usp=drive_link'
};

/**
 * Función principal para actualizar imágenes
 */
async function updateProductImages() {
  console.log('\n' + '='.repeat(70));
  console.log('   ACTUALIZACIÓN MASIVA DE IMÁGENES DE PRODUCTOS - ARTESA');
  console.log('='.repeat(70) + '\n');
  
  if (DRY_RUN) {
    console.log('⚠️  MODO SIMULACIÓN ACTIVADO - No se aplicarán cambios a la BD\n');
  }

  const stats = {
    total: Object.keys(productImages).length,
    updated: 0,
    notFound: 0,
    errors: 0,
    errorDetails: []
  };

  const client = await pool.connect();
  
  try {
    logger.info(`📊 Total de productos a procesar: ${stats.total}`);
    
    if (!DRY_RUN) {
      await client.query('BEGIN');
      logger.info('🔄 Transacción iniciada');
    }

    // Procesar cada producto
    for (const [sapCode, googleDriveUrl] of Object.entries(productImages)) {
      try {
        // Convertir URL
        const directUrl = convertGoogleDriveUrl(googleDriveUrl);

        // Verificar existencia del producto
        const checkQuery = 'SELECT product_id, name, image_url FROM products WHERE sap_code = $1';
        const checkResult = await client.query(checkQuery, [sapCode]);

        if (checkResult.rows.length === 0) {
          console.log(`❌ ${sapCode}: No encontrado en la base de datos`);
          stats.notFound++;
          stats.errorDetails.push({
            sapCode,
            error: 'Producto no encontrado'
          });
          continue;
        }

        const product = checkResult.rows[0];
        const productId = product.product_id;
        const productName = product.name;

        console.log(`\n📦 ${sapCode} - ${productName || 'Sin nombre'}`);
        console.log(`   ID: ${productId}`);
        console.log(`   📷 URL nueva: ${directUrl.substring(0, 60)}...`);

        if (!DRY_RUN) {
          // Actualizar tabla products
          await client.query(
            'UPDATE products SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2',
            [directUrl, productId]
          );

          // Actualizar/insertar en product_images
          await client.query(
            `INSERT INTO product_images(sap_code, image_url, last_updated) 
             VALUES($1, $2, CURRENT_TIMESTAMP) 
             ON CONFLICT (sap_code) 
             DO UPDATE SET image_url = $2, last_updated = CURRENT_TIMESTAMP`,
            [sapCode, directUrl]
          );

          console.log(`   ✅ Actualizado exitosamente`);
        } else {
          console.log(`   ℹ️  Sería actualizado (modo simulación)`);
        }
        
        stats.updated++;

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        stats.errors++;
        stats.errorDetails.push({
          sapCode,
          error: error.message
        });
      }
    }

    if (!DRY_RUN) {
      await client.query('COMMIT');
      logger.info('✅ Transacción confirmada');
    }

  } catch (error) {
    if (!DRY_RUN) {
      await client.query('ROLLBACK');
      logger.error('💥 Error crítico - Transacción revertida', { error: error.message });
    }
    throw error;
  } finally {
    client.release();
  }

  // Generar resumen
  console.log('\n' + '='.repeat(70));
  console.log('   RESUMEN DE ACTUALIZACIÓN');
  console.log('='.repeat(70));
  console.log(`\n📊 Total procesados:     ${stats.total}`);
  console.log(`✅ Actualizados:         ${stats.updated}`);
  console.log(`❌ No encontrados:       ${stats.notFound}`);
  console.log(`⚠️  Errores:              ${stats.errors}`);

  if (stats.errorDetails.length > 0) {
    console.log(`\n⚠️  PRODUCTOS CON ERRORES:`);
    stats.errorDetails.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.sapCode}: ${err.error}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  
  if (DRY_RUN) {
    console.log('\n⚠️  SIMULACIÓN COMPLETADA - No se modificó la base de datos');
    console.log('💡 Ejecuta sin --dry-run para aplicar los cambios reales\n');
  } else {
    console.log('\n✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE\n');
  }

  // Generar reporte en archivo
  const reportContent = generateReport(stats);
  const reportPath = path.join(__dirname, `../logs/image-update-${Date.now()}.txt`);
  
  try {
    // Crear directorio de logs si no existe
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, reportContent);
    console.log(`📄 Reporte guardado en: ${reportPath}\n`);
  } catch (err) {
    logger.warn('No se pudo guardar el reporte', { error: err.message });
  }

  return stats;
}

/**
 * Generar reporte en texto
 */
function generateReport(stats) {
  const lines = [];
  lines.push('='.repeat(70));
  lines.push('   REPORTE DE ACTUALIZACIÓN DE IMÁGENES - ARTESA');
  lines.push('='.repeat(70));
  lines.push('');
  lines.push(`Fecha: ${new Date().toLocaleString('es-CO')}`);
  lines.push(`Modo: ${DRY_RUN ? 'SIMULACIÓN' : 'PRODUCCIÓN'}`);
  lines.push('');
  lines.push('RESUMEN:');
  lines.push(`  Total procesados:  ${stats.total}`);
  lines.push(`  Actualizados:      ${stats.updated}`);
  lines.push(`  No encontrados:    ${stats.notFound}`);
  lines.push(`  Errores:           ${stats.errors}`);
  lines.push('');
  
  if (stats.errorDetails.length > 0) {
    lines.push('PRODUCTOS CON ERRORES:');
    stats.errorDetails.forEach((err, idx) => {
      lines.push(`  ${idx + 1}. ${err.sapCode}: ${err.error}`);
    });
    lines.push('');
  }
  
  lines.push('='.repeat(70));
  
  return lines.join('\n');
}

// Ejecutar script
(async () => {
  try {
    await updateProductImages();
    process.exit(0);
  } catch (error) {
    logger.error('💥 Error fatal en la ejecución', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    await pool.end();
    console.log('🔌 Conexión a base de datos cerrada\n');
  }
})();

module.exports = { updateProductImages, convertGoogleDriveUrl };