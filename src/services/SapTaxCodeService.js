const SapBaseService = require('./SapBaseService');
const cron = require('node-cron');
const pool = require('../config/db');

/**
 * Servicio para sincronizar el catálogo de códigos de impuesto (SalesTaxCodes/OSTC)
 * desde SAP B1 Service Layer hacia las tablas locales tax_codes / tax_code_components.
 * Sigue el mismo patrón de SapProductService.updateTaxCodesByGroup() y
 * SapClientService.getPriceListsFromSAP().
 */
class SapTaxCodeService extends SapBaseService {
  constructor() {
    super('SapTaxCodeService');
    // Misma frecuencia que la sincronización diaria de listas de precios/productos.
    this.syncSchedule = process.env.SAP_TAX_CODE_SYNC_SCHEDULE || process.env.SAP_SYNC_SCHEDULE || '0 0 * * *';
  }

  async initialize() {
    if (this.initialized) return this;
    await super.initialize();
    this.scheduleSyncTask();
    return this;
  }

  scheduleSyncTask() {
    if (!cron.validate(this.syncSchedule)) {
      this.logger.error('Formato de programación inválido para sincronización de tax_codes', {
        schedule: this.syncSchedule
      });
      return;
    }

    this.logger.info('Programando sincronización diaria de tax_codes', { schedule: this.syncSchedule });

    cron.schedule(this.syncSchedule, async () => {
      try {
        this.logger.info('Iniciando sincronización programada de tax_codes');
        await this.syncTaxCodesFromSAP();
        this.logger.info('Sincronización programada de tax_codes finalizada');
      } catch (error) {
        this.logger.error('Error en sincronización programada de tax_codes', {
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  /**
   * Clasifica un componente (SalesTaxAuthority) en una categoría de negocio,
   * a partir de su código/nombre reales en SAP. No asume nada de tax_code_ar:
   * la clasificación vive en la tabla, corregible sin deploy si SAP agrega códigos nuevos.
   * @param {string} componentCode
   * @param {string} componentName
   * @returns {'IVA'|'IMPUESTO_SALUDABLE'|'OTRO'}
   */
  static classifyComponent(componentCode, componentName) {
    const code = (componentCode || '').toUpperCase();
    const name = (componentName || '').toUpperCase();

    if (code.startsWith('IMSB')) return 'IMPUESTO_SALUDABLE';
    if (code.startsWith('IVA')) return 'IVA';
    if (name.includes('SALUDABLE')) return 'IMPUESTO_SALUDABLE';
    if (name.includes('IVA')) return 'IVA';
    return 'OTRO';
  }

  /**
   * Trae el catálogo completo de SalesTaxCodes y SalesTaxAuthorities desde SAP
   * y sincroniza tax_codes / tax_code_components.
   * @returns {Promise<{total: number, updated: number, errors: number}>}
   */
  async syncTaxCodesFromSAP() {
    const stats = { total: 0, updated: 0, errors: 0 };

    // 1. Traer autoridades fiscales (para tener el Name de cada componente)
    const authoritiesByCode = {};
    let skip = 0;
    const batchSize = 100;
    let hasMore = true;

    while (hasMore) {
      const page = await this.request('GET', `SalesTaxAuthorities?$top=${batchSize}&$skip=${skip}`);
      const rows = page?.value || [];
      rows.forEach(a => { authoritiesByCode[a.Code] = a; });
      hasMore = rows.length === batchSize;
      skip += batchSize;
    }

    // 2. Traer códigos de impuesto (OSTC) activos y válidos para ventas
    skip = 0;
    hasMore = true;
    const client = await pool.connect();

    try {
      while (hasMore) {
        const page = await this.request('GET', `SalesTaxCodes?$top=${batchSize}&$skip=${skip}`);
        const rows = page?.value || [];

        if (rows.length === 0) {
          hasMore = false;
          continue;
        }

        await client.query('BEGIN');

        for (const sapCode of rows) {
          try {
            const lines = sapCode.SalesTaxCodes_Lines || [];

            await client.query(
              `INSERT INTO tax_codes (code, name, total_rate, is_composite, active, valid_for_ar, sap_raw_payload, last_synced_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               ON CONFLICT (code) DO UPDATE SET
                 name = EXCLUDED.name,
                 total_rate = EXCLUDED.total_rate,
                 is_composite = EXCLUDED.is_composite,
                 active = EXCLUDED.active,
                 valid_for_ar = EXCLUDED.valid_for_ar,
                 sap_raw_payload = EXCLUDED.sap_raw_payload,
                 last_synced_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP`,
              [
                sapCode.Code,
                sapCode.Name,
                (parseFloat(sapCode.Rate) || 0) / 100,
                lines.length > 1,
                sapCode.Inactive === 'tNO',
                sapCode.ValidForAR === 'tYES',
                JSON.stringify(sapCode)
              ]
            );

            // Reemplazar componentes existentes de este código con los actuales de SAP
            await client.query('DELETE FROM tax_code_components WHERE tax_code = $1', [sapCode.Code]);

            for (const line of lines) {
              const authority = authoritiesByCode[line.STACode];
              const componentName = authority?.Name || null;
              const category = SapTaxCodeService.classifyComponent(line.STACode, componentName);

              await client.query(
                `INSERT INTO tax_code_components (tax_code, component_code, component_name, category, rate, row_number)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (tax_code, component_code) DO UPDATE SET
                   component_name = EXCLUDED.component_name,
                   category = EXCLUDED.category,
                   rate = EXCLUDED.rate,
                   row_number = EXCLUDED.row_number`,
                [
                  sapCode.Code,
                  line.STACode,
                  componentName,
                  category,
                  (parseFloat(line.EffectiveRate) || 0) / 100,
                  line.RowNumber || 0
                ]
              );
            }

            stats.updated += 1;
          } catch (error) {
            stats.errors += 1;
            this.logger.error('Error sincronizando tax_code individual', {
              code: sapCode.Code,
              error: error.message
            });
          }
          stats.total += 1;
        }

        await client.query('COMMIT');
        hasMore = rows.length === batchSize;
        skip += batchSize;
      }

      this.logger.info('Sincronización de tax_codes finalizada', stats);
      return stats;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error en sincronización de tax_codes, se revirtió la transacción en curso', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = SapTaxCodeService;
