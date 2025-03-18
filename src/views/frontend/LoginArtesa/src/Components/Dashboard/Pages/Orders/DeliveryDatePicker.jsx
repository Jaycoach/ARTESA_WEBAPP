import React, { useState, useEffect } from 'react';

/**
 * Componente para seleccionar fecha de entrega según reglas de negocio
 * @param {Object} props - Props del componente
 * @param {string} props.value - Valor seleccionado
 * @param {function} props.onChange - Función para manejar cambios
 * @param {string} props.orderTimeLimit - Límite de tiempo para pedidos (formato "HH:MM")
 */
const DeliveryDatePicker = ({ value, onChange, orderTimeLimit = "18:00" }) => {
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    calculateAvailableDates();
  }, [orderTimeLimit]);

  // Calcula las fechas disponibles según reglas de negocio
const calculateAvailableDates = () => {
  setLoading(true);
  try {
    const dates = [];
    const now = new Date();
    const currentDay = now.getDay(); // 0 (domingo) a 6 (sábado)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Convertir orderTimeLimit a horas y minutos
    const [limitHours, limitMinutes] = orderTimeLimit.split(':').map(Number);
    const isPastTimeLimit = currentHour > limitHours || 
      (currentHour === limitHours && currentMinute >= limitMinutes);

    // Reglas para calcular fechas de entrega
    let startOffset = 2; // Mínimo 2 días en el futuro para entrega

    // Regla especial para sábados
    if (currentDay === 6) { // Sábado
      if (currentHour >= 12) { // Después del mediodía
        // Después del mediodía, entrega el miércoles (4 días después)
        startOffset = 4;
        console.log("Sábado después del mediodía: entrega miércoles (4 días)");
      } else {
        // Antes del mediodía, entrega el martes (3 días después)
        startOffset = 3;
        console.log("Sábado antes del mediodía: entrega martes (3 días)");
      }
    } 
    // Regla para domingos - siempre entrega el miércoles (3 días)
    else if (currentDay === 0) {
      startOffset = 3;
      console.log("Domingo: entrega miércoles (3 días)");
    }
    // Para otros días, mínimo 2 días de entrega
    else {
      startOffset = 2;
      console.log(`Día regular (${currentDay}): entrega en 2 días mínimo`);
      
      // Si pasó el límite de tiempo, agregar un día extra
      if (isPastTimeLimit) {
        startOffset++;
        console.log(`Pasado el límite de ${orderTimeLimit}, se agrega 1 día más`);
      }
    }

    console.log(`Fecha actual: ${now.toLocaleString()}, Offset de días: ${startOffset}`);

    // Generar fechas disponibles (5 opciones empezando desde la primera disponible)
    for (let i = 0; i < 10; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + startOffset + i);
      
      // Omitir domingos (día no laboral)
      if (date.getDay() === 0) {
        continue;
      }
      
      // Formatear fecha para mostrar
      const formattedDate = date.toISOString().split('T')[0];
      dates.push({
        value: formattedDate,
        label: formatDateToSpanish(date)
      });
      
      // Solo incluir 5 fechas válidas
      if (dates.length === 5) break;
    }

    setAvailableDates(dates);
    console.log("Fechas disponibles:", dates);
    
    // Si no hay fecha seleccionada, seleccionar la primera disponible
    if (!value && dates.length > 0) {
      onChange(dates[0].value);
    }
    
  } catch (error) {
    console.error('Error calculando fechas disponibles:', error);
    setErrorMessage('Error al calcular fechas de entrega disponibles');
  } finally {
    setLoading(false);
  }
};

  // Formatea la fecha a español: "Lunes, 18 de Marzo de 2025"
  const formatDateToSpanish = (date) => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('es-ES', options);
  };

  if (loading) {
    return <div className="text-gray-500">Calculando fechas disponibles...</div>;
  }

  if (errorMessage) {
    return <div className="text-red-500">{errorMessage}</div>;
  }

  return (
    <div className="delivery-date-picker">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      >
        {availableDates.map((date) => (
          <option key={date.value} value={date.value}>
            {date.label}
          </option>
        ))}
      </select>
      <p className="mt-1 text-sm text-gray-500">
        Las entregas se procesan en días hábiles (lunes a sábado).
      </p>
    </div>
  );
};

export default DeliveryDatePicker;