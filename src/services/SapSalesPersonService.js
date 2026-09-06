const SapBaseService = require('./SapBaseService');

/**
 * Consulta de vendedores (SalesPersons) de SAP B1, para mapear admins BackOffice
 * a un SalesEmployeeCode real. Solo lectura — no crea ni modifica maestros en SAP.
 */
class SapSalesPersonService extends SapBaseService {
  constructor() {
    super('SapSalesPersonService');
  }

  /**
   * Lista los vendedores activos de SAP (SalesPersons / OSLP).
   * @returns {Promise<Array<{code: number, name: string}>>}
   */
  async getSalesPersons() {
    const response = await this.request('GET', "SalesPersons?$select=SalesEmployeeCode,SalesEmployeeName&$orderby=SalesEmployeeName");
    const rows = response.value || response;
    return rows.map(r => ({ code: r.SalesEmployeeCode, name: r.SalesEmployeeName }));
  }
}

module.exports = new SapSalesPersonService();
