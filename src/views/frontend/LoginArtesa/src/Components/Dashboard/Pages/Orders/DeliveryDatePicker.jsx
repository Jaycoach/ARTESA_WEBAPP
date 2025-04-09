import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from 'react-datepicker';
import es from 'date-fns/locale/es';
import { addDays, addMonths, isSameDay, format } from 'date-fns';

registerLocale('es', es);

/**
 * Componente para seleccionar fecha de entrega según reglas de negocio
 * @param {Object} props - Props del componente
 * @param {string} props.value - Valor seleccionado
 * @param {function} props.onChange - Función para manejar cambios
 * @param {string} props.orderTimeLimit - Límite de tiempo para pedidos (formato "HH:MM")
 */

const DeliveryDatePicker = ({ value, onChange, orderTimeLimit = "18:00" }) => {
  const [availableDates, setAvailableDates] = useState([]);
  const [allPossibleDates, setAllPossibleDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    calculateAvailableDates();
  }, [orderTimeLimit]);

  // Calcula las fechas disponibles según reglas de negocio
  const calculateAvailableDates = () => {
    setLoading(true);
    try {
      const dates = [];
      const allDates = []; // Para almacenar todas las fechas posibles (1 mes)
      const now = new Date();
      const currentDay = now.getDay(); // 0 (domingo) a 6 (sábado)
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Convertir orderTimeLimit a horas y minutos
      const [limitHours, limitMinutes] = orderTimeLimit.split(':').map(Number);
      const isPastTimeLimit = currentHour > limitHours ||
        (currentHour === limitHours && currentMinute >= limitMinutes);

      // Reglas para calcular días de entrega mínimos basados en el día actual
      let startOffset = 2; // Mínimo 2 días en el futuro para entrega normalmente

      // Regla especial para sábados
      if (currentDay === 6) { // Sábado
        startOffset = currentHour >= 12 ? 4 : 3;
      } else if (currentDay === 0) {
        startOffset = 3;
      } else if (isPastTimeLimit) {
        startOffset++;
      }

      // Fecha de inicio para entregas
      const startDate = addDays(now, startOffset);
      const endDate = addMonths(now, 1);

      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        if (currentDate.getDay() !== 0) {
          const formattedDate = format(currentDate, 'yyyy-MM-dd');
          allDates.push({
            value: formattedDate,
            label: formatDateToSpanish(currentDate),
            date: new Date(currentDate)
          });
          if (dates.length < 5) dates.push({
            value: formattedDate,
            label: formatDateToSpanish(currentDate)
          });
        }
        currentDate = addDays(currentDate, 1);
      }

      setAvailableDates(dates);
      setAllPossibleDates(allDates);

      if (!value && dates.length > 0) {
        onChange(dates[0].value);
        setSelectedDate(new Date(dates[0].value));
      }
    } catch (error) {
      console.error('Error calculando fechas disponibles:', error);
      setErrorMessage('Error al calcular fechas de entrega disponibles');
    } finally {
      setLoading(false);
    }
  };

  const formatDateToSpanish = (date) => {
    return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  };

  const isDateAvailable = (date) => {
    return allPossibleDates.some(d => isSameDay(d.date, date));
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    onChange(format(date, 'yyyy-MM-dd'));
  };

  if (loading) {
    return <div className="text-gray-500 flex items-center">
      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Calculando fechas disponibles...
    </div>;
  }

  if (errorMessage) {
    return <div className="text-red-500 flex items-center">
      <span className="mr-2">❌</span>
      {errorMessage}
    </div>;
  }

  return (
    <div className="delivery-date-picker space-y-4">
      {/* Menú desplegable con botón para mostrar calendario */}
      <div className="relative">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setCalendarOpen(!calendarOpen)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {calendarOpen ? (
              <span className="flex items-center">
                <span className="mr-1">📅</span> Cerrar
              </span>
            ) : (
              <span className="flex items-center">
                <span className="mr-1">📅</span> Ver calendario
              </span>
            )}
          </button>
        </div>

        {/* Calendario desplegable */}
        {calendarOpen && (
          <div className="absolute z-10 mt-2 w-full bg-white rounded-md shadow-lg border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-gray-700">Selecciona fecha de entrega</h4>
              <button
                onClick={() => setCalendarOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <DatePicker
              selected={value ? new Date(value) : null}
              onChange={(date) => {
                onChange(date.toISOString().split('T')[0]);
                setCalendarOpen(false);
              }}
              filterDate={isDateAvailable}
              minDate={allPossibleDates[0]?.date}
              maxDate={allPossibleDates[allPossibleDates.length - 1]?.date}
              locale="es"
              inline
              monthsShown={1}
              showMonthDropdown={false} // Simplificamos quitando el dropdown de meses
              className="border-0"
              dayClassName={(date) => {
                // Destacar la fecha seleccionada con un color diferente
                if (value && isSameDay(date, new Date(value))) {
                  return 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 font-medium';
                }

                return isDateAvailable(date)
                  ? 'cursor-pointer bg-white hover:bg-blue-50 text-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50';
              }}
              renderCustomHeader={({
                date,
                decreaseMonth,
                increaseMonth,
                prevMonthButtonDisabled,
                nextMonthButtonDisabled,
              }) => (
                <div className="flex justify-between items-center px-2 py-2">
                  <button
                    onClick={decreaseMonth}
                    disabled={prevMonthButtonDisabled}
                    className={`p-1 rounded-full ${prevMonthButtonDisabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    ←
                  </button>
                  <div className="text-sm font-medium text-gray-700">
                    {date.toLocaleString('es', { month: 'long', year: 'numeric' })}
                  </div>
                  <button
                    onClick={increaseMonth}
                    disabled={nextMonthButtonDisabled}
                    className={`p-1 rounded-full ${nextMonthButtonDisabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    →
                  </button>
                </div>
              )}
            />
            
            <div className="mt-2 flex flex-col space-y-1">
              <div className="flex items-center text-xs text-gray-500">
                <span className="w-3 h-3 inline-block bg-indigo-100 rounded-full mr-2"></span>
                <span>Fecha seleccionada</span>
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <span className="w-3 h-3 inline-block bg-white border border-gray-300 rounded-full mr-2"></span>
                <span>Fechas disponibles</span>
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <span className="w-3 h-3 inline-block bg-gray-100 rounded-full mr-2"></span>
                <span>Fechas no disponibles</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-500 flex items-center">
        <span className="text-amber-500 mr-2">⚠️</span>
        Las entregas se procesan en días hábiles (lunes a sábado).
      </p>
    </div>
  );
};

export default DeliveryDatePicker;