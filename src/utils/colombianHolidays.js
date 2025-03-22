/**
 * Utilidad para manejar días festivos de Colombia
 * Basado en la ley 51 de 1983
 */

// Función para determinar el domingo de Pascua (Algoritmo de Gauss)
function getEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    return new Date(year, month - 1, day);
  }
  
  // Trasladar festivos según ley colombiana (lunes siguiente)
  function getNextMonday(date) {
    const dayOfWeek = date.getDay(); // 0 = domingo, 1 = lunes, etc.
    let daysToAdd = 1; // Por defecto, sumar 1 día (siguiente día)
    
    if (dayOfWeek === 0) { // Si es domingo, el siguiente día ya es lunes
      daysToAdd = 1;
    } else if (dayOfWeek === 1) { // Si es lunes, sumar 7 días (lunes siguiente)
      daysToAdd = 7;
    } else { // Para cualquier otro día, calcular días hasta el próximo lunes
      daysToAdd = 8 - dayOfWeek;
    }
    
    const result = new Date(date);
    result.setDate(date.getDate() + daysToAdd);
    return result;
  }
  
  // Generar lista de festivos para un año específico
  function getColombianHolidays(year) {
    // Festivos fijos
    const holidays = [
      { day: 1, month: 1, name: "Año Nuevo", variable: false }, // Año Nuevo
      { day: 1, month: 5, name: "Día del Trabajo", variable: false }, // Día del Trabajo
      { day: 20, month: 7, name: "Día de la Independencia", variable: false }, // Independencia
      { day: 7, month: 8, name: "Batalla de Boyacá", variable: false }, // Boyacá
      { day: 8, month: 12, name: "Inmaculada Concepción", variable: false }, // Inmaculada Concepción
      { day: 25, month: 12, name: "Navidad", variable: false } // Navidad
    ];
  
    // Calcular festivos basados en Pascua
    const easterSunday = getEasterSunday(year);
    
    // Jueves Santo (3 días antes de Pascua)
    const holyThursday = new Date(easterSunday);
    holyThursday.setDate(easterSunday.getDate() - 3);
    
    // Viernes Santo (2 días antes de Pascua)
    const goodFriday = new Date(easterSunday);
    goodFriday.setDate(easterSunday.getDate() - 2);
  
    // Festivos que caen 60, 68, 71, etc días después de Pascua 
    // o festivos emilianizados (trasladados al lunes siguiente)
    const variableHolidays = [
      { days: -48, name: "Día de los Reyes Magos", emilianizar: true, baseDate: 6, baseMonth: 1 },
      { days: 0, name: "Día de San José", emilianizar: true, baseDate: 19, baseMonth: 3 },
      { days: -3, name: "Jueves Santo", emilianizar: false },
      { days: -2, name: "Viernes Santo", emilianizar: false },
      { days: 39, name: "Ascensión de Jesús", emilianizar: true, baseDate: 13, baseMonth: 5 },
      { days: 60, name: "Corpus Christi", emilianizar: true, baseDate: 3, baseMonth: 6 },
      { days: 68, name: "Sagrado Corazón", emilianizar: true, baseDate: 11, baseMonth: 6 },
      { days: 141, name: "San Pedro y San Pablo", emilianizar: true, baseDate: 29, baseMonth: 6 },
      { days: 226, name: "Asunción de la Virgen", emilianizar: true, baseDate: 15, baseMonth: 8 },
      { days: 285, name: "Día de la Raza", emilianizar: true, baseDate: 12, baseMonth: 10 },
      { days: 319, name: "Todos los Santos", emilianizar: true, baseDate: 1, baseMonth: 11 },
      { days: 333, name: "Independencia de Cartagena", emilianizar: true, baseDate: 11, baseMonth: 11 }
    ];
  
    // Calcular fechas para los festivos variables
    variableHolidays.forEach(holiday => {
      if (holiday.days === -3 || holiday.days === -2) {
        // Jueves y Viernes Santo, directo de la fecha calculada
        const date = new Date(easterSunday);
        date.setDate(easterSunday.getDate() + holiday.days);
        holidays.push({
          day: date.getDate(),
          month: date.getMonth() + 1, // Mes en JS es 0-indexado
          name: holiday.name,
          variable: false
        });
      } else if (holiday.emilianizar) {
        // Para los festivos emilianizados, tenemos dos opciones:
        // 1. Basado en Pascua si la fecha base no está definida
        let dateToEmilianize;
        if (holiday.baseDate && holiday.baseMonth) {
          // 2. Basado en fecha fija
          dateToEmilianize = new Date(year, holiday.baseMonth - 1, holiday.baseDate);
        } else {
          // Basado en Pascua
          dateToEmilianize = new Date(easterSunday);
          dateToEmilianize.setDate(easterSunday.getDate() + holiday.days);
        }
        
        // Si no cae en lunes, trasladar al lunes siguiente
        if (dateToEmilianize.getDay() !== 1) {
          const nextMonday = getNextMonday(dateToEmilianize);
          holidays.push({
            day: nextMonday.getDate(),
            month: nextMonday.getMonth() + 1,
            name: holiday.name,
            variable: true
          });
        } else {
          holidays.push({
            day: dateToEmilianize.getDate(),
            month: dateToEmilianize.getMonth() + 1,
            name: holiday.name,
            variable: true
          });
        }
      }
    });
  
    // Convertir a fechas reales
    return holidays.map(h => {
      const date = new Date(year, h.month - 1, h.day);
      return {
        date,
        name: h.name,
        variable: h.variable
      };
    }).sort((a, b) => a.date - b.date); // Ordenar por fecha
  }
  
  /**
   * Verifica si una fecha es festivo en Colombia
   * @param {Date} date - Fecha a verificar
   * @returns {boolean} - true si es festivo, false si no
   */
  function isColombianHoliday(date) {
    const year = date.getFullYear();
    const holidays = getColombianHolidays(year);
    
    // Formato para comparar solo año, mes y día
    const dateStr = date.toISOString().substring(0, 10);
    
    return holidays.some(holiday => {
      const holidayStr = holiday.date.toISOString().substring(0, 10);
      return holidayStr === dateStr;
    });
  }
  
  /**
   * Verifica si una fecha es un día laborable (no es fin de semana ni festivo)
   * @param {Date} date - Fecha a verificar
   * @returns {boolean} - true si es día laborable, false si no
   */
  function isWorkingDay(date) {
    const dayOfWeek = date.getDay();
    // Verificar si no es fin de semana (0 = domingo, 6 = sábado)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    // Si no es fin de semana, verificar si no es festivo
    return !isWeekend && !isColombianHoliday(date);
  }
  
  /**
   * Obtiene el próximo día laborable (no cuenta fines de semana ni festivos)
   * @param {Date} date - Fecha de inicio
   * @param {number} workingDaysToAdd - Número de días laborables a añadir
   * @returns {Date} - Fecha resultado después de añadir días laborables
   */
  function getNextWorkingDay(date, workingDaysToAdd = 1) {
    const result = new Date(date);
    let daysAdded = 0;
    
    while (daysAdded < workingDaysToAdd) {
      // Avanzar un día
      result.setDate(result.getDate() + 1);
      // Si es día laborable, incrementar contador
      if (isWorkingDay(result)) {
        daysAdded++;
      }
    }
    
    return result;
  }
  
  /**
   * Añade días laborables a una fecha
   * @param {Date} date - Fecha de inicio
   * @param {number} workingDays - Días laborables a añadir
   * @returns {Date} - Nueva fecha después de añadir los días laborables
   */
  function addWorkingDays(date, workingDays) {
    return getNextWorkingDay(date, workingDays);
  }
  
  module.exports = {
    getColombianHolidays,
    isColombianHoliday,
    isWorkingDay,
    getNextWorkingDay,
    addWorkingDays
  };