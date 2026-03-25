/**
 * Utilidad de festivos colombianos para el frontend
 * Portada de src/utils/colombianHolidays.js (backend)
 * Basado en la ley 51 de 1983
 */

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

function getNextMonday(date) {
  const dayOfWeek = date.getDay();
  let daysToAdd;
  if (dayOfWeek === 0) {
    daysToAdd = 1;
  } else if (dayOfWeek === 1) {
    daysToAdd = 7;
  } else {
    daysToAdd = 8 - dayOfWeek;
  }
  const result = new Date(date);
  result.setDate(date.getDate() + daysToAdd);
  return result;
}

export function getColombianHolidays(year) {
  const holidays = [
    { day: 1,  month: 1,  name: 'Año Nuevo' },
    { day: 1,  month: 5,  name: 'Día del Trabajo' },
    { day: 20, month: 7,  name: 'Día de la Independencia' },
    { day: 7,  month: 8,  name: 'Batalla de Boyacá' },
    { day: 8,  month: 12, name: 'Inmaculada Concepción' },
    { day: 25, month: 12, name: 'Navidad' },
  ];

  const easterSunday = getEasterSunday(year);

  const variableHolidays = [
    { days: -48, name: 'Día de los Reyes Magos',      emilianizar: true,  baseDate: 6,  baseMonth: 1  },
    { days: 0,   name: 'Día de San José',              emilianizar: true,  baseDate: 19, baseMonth: 3  },
    { days: -3,  name: 'Jueves Santo',                 emilianizar: false },
    { days: -2,  name: 'Viernes Santo',                emilianizar: false },
    { days: 39,  name: 'Ascensión de Jesús',           emilianizar: true,  baseDate: 13, baseMonth: 5  },
    { days: 60,  name: 'Corpus Christi',               emilianizar: true,  baseDate: 3,  baseMonth: 6  },
    { days: 68,  name: 'Sagrado Corazón',              emilianizar: true,  baseDate: 11, baseMonth: 6  },
    { days: 141, name: 'San Pedro y San Pablo',        emilianizar: true,  baseDate: 29, baseMonth: 6  },
    { days: 226, name: 'Asunción de la Virgen',        emilianizar: true,  baseDate: 15, baseMonth: 8  },
    { days: 285, name: 'Día de la Raza',               emilianizar: true,  baseDate: 12, baseMonth: 10 },
    { days: 319, name: 'Todos los Santos',             emilianizar: true,  baseDate: 1,  baseMonth: 11 },
    { days: 333, name: 'Independencia de Cartagena',   emilianizar: true,  baseDate: 11, baseMonth: 11 },
  ];

  variableHolidays.forEach(holiday => {
    if (holiday.days === -3 || holiday.days === -2) {
      const date = new Date(easterSunday);
      date.setDate(easterSunday.getDate() + holiday.days);
      holidays.push({ day: date.getDate(), month: date.getMonth() + 1, name: holiday.name });
    } else if (holiday.emilianizar) {
      let dateToEmilianize;
      if (holiday.baseDate && holiday.baseMonth) {
        dateToEmilianize = new Date(year, holiday.baseMonth - 1, holiday.baseDate);
      } else {
        dateToEmilianize = new Date(easterSunday);
        dateToEmilianize.setDate(easterSunday.getDate() + holiday.days);
      }
      if (dateToEmilianize.getDay() !== 1) {
        const nextMonday = getNextMonday(dateToEmilianize);
        holidays.push({ day: nextMonday.getDate(), month: nextMonday.getMonth() + 1, name: holiday.name });
      } else {
        holidays.push({ day: dateToEmilianize.getDate(), month: dateToEmilianize.getMonth() + 1, name: holiday.name });
      }
    }
  });

  return holidays.map(h => new Date(year, h.month - 1, h.day))
    .sort((a, b) => a - b);
}

export function isColombianHoliday(date) {
  const year = date.getFullYear();
  const holidays = getColombianHolidays(year);
  const d = date.getDate();
  const m = date.getMonth();
  return holidays.some(h => h.getDate() === d && h.getMonth() === m);
}
