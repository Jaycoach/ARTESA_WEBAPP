import React, { useState, useEffect, useCallback, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from 'react-datepicker';
import es from 'date-fns/locale/es';
import { addDays, addMonths, isSameDay, format, parseISO } from 'date-fns';

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
  const initialLoadRef = useRef(true);

  // 1. Cálculo centralizado del offset de días
  const calculateStartOffset = useCallback(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const [limitHours, limitMinutes] = orderTimeLimit.split(':').map(Number);
    
    // Offset mínimo garantizado: 2 días
    let offset = 2;
    
    // Reglas específicas que pueden incrementar el offset
    if (currentDay === 6) { // Sábado
      offset = currentHour >= 12 ? 4 : 3;
    } else if (currentDay === 0) { // Domingo
      offset = 3;
    } else if (currentHour > limitHours || 
              (currentHour === limitHours && currentMinute >= limitMinutes)) {
      // Después del límite horario
      offset += 1;
    }
    
    // Verificar si la fecha calculada cae en domingo
    const calculatedDate = addDays(now, offset);
    if (calculatedDate.getDay() === 0) {
      return offset + 1; // Añadir un día más si cae en domingo
    }
    
    return offset;
  }, [orderTimeLimit]);

  // 2. Cálculo de fechas disponibles
  const calculateAvailableDates = useCallback(() => {
    setLoading(true);
    try {
      const dates = [];
      const allDates = [];
      const now = new Date();
      
      // Obtener offset inicial
      const startOffset = calculateStartOffset();
      const startDate = addDays(now, startOffset);
      const endDate = addMonths(now, 1);
      
      console.log(`Fecha actual: ${format(now, 'yyyy-MM-dd HH:mm')}`);
      console.log(`Offset calculado: ${startOffset} días`);
      console.log(`Primera fecha disponible: ${format(startDate, 'yyyy-MM-dd')}`);
      
      let currentDate = new Date(startDate);
      
      // Generar fechas disponibles
      while (currentDate <= endDate) {
        if (currentDate.getDay() !== 0) { // Excluir domingos
          const formattedDate = format(currentDate, 'yyyy-MM-dd');
          
          allDates.push({
            value: formattedDate,
            label: formatDateToSpanish(currentDate),
            date: new Date(currentDate)
          });
          
          if (dates.length < 5) {
            dates.push({
              value: formattedDate,
              label: formatDateToSpanish(currentDate)
            });
          }
        }
        currentDate = addDays(currentDate, 1);
      }
      
      if (allDates.length === 0) {
        throw new Error('No se pudieron calcular fechas disponibles');
      }
      
      setAvailableDates(dates);
      setAllPossibleDates(allDates);
      
      // Solo establecer la fecha inicial si:
      // 1. No hay valor seleccionado previamente
      // 2. Es la carga inicial (controlado por ref)
      if (initialLoadRef.current && (!value || value === '')) {
        const newDate = new Date(allDates[0].date);
        onChange(format(newDate, 'yyyy-MM-dd'));
        setSelectedDate(newDate);
        initialLoadRef.current = false;
      }
      
    } catch (error) {
      console.error('Error calculando fechas disponibles:', error);
      setErrorMessage('Error al calcular fechas de entrega disponibles');
    } finally {
      setLoading(false);
    }
  }, [calculateStartOffset, onChange, value]);

  // 3. Formateo consistente de fechas
  const formatDateToSpanish = (date) => {
    return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  };
  
  // 4. Verificación de fecha disponible (memoizada)
  const isDateAvailable = useCallback((date) => {
    return allPossibleDates.some(d => isSameDay(d.date, date));
  }, [allPossibleDates]);

  // 5. Manejo consistente de cambios de fecha
  const handleDateChange = useCallback((date) => {
    const utcDate = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      12, 0, 0
    ));
    const formattedDate = format(utcDate, 'yyyy-MM-dd');
  console.log(`Fecha seleccionada: ${formattedDate} (UTC)`);
  
  setSelectedDate(date);
  onChange(formattedDate);
}, [onChange]);

  // Efectos

  // Inicialización y recálculo cuando cambia el límite horario
  useEffect(() => {
    calculateAvailableDates();
  }, [calculateAvailableDates]);

  // Sincronización cuando cambia el valor externo
  useEffect(() => {
    if (value && value !== '') {
      try {
        // Asegurar que la fecha externa esté en el formato correcto
        const parsedDate = parseISO(value);
        
        // Verificar si esta fecha existe en nuestras fechas disponibles
        const isValid = allPossibleDates.some(d => 
          isSameDay(d.date, parsedDate)
        );
        
        if (isValid) {
          setSelectedDate(parsedDate);
        } else if (allPossibleDates.length > 0) {
          // Si la fecha no es válida pero tenemos fechas disponibles,
          // seleccionar la primera fecha disponible
          console.warn('Fecha recibida no válida, usando primera fecha disponible');
          const newDate = new Date(allPossibleDates[0].date);
          setSelectedDate(newDate);
          onChange(format(newDate, 'yyyy-MM-dd'));
        }
      } catch (error) {
        console.error('Error al procesar la fecha recibida:', error);
      }
    }
  }, [value, allPossibleDates, onChange]);

  // Renderizado condicional
  if (loading) {
    return (
      <div className="text-gray-500 flex items-center">
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Calculando fechas disponibles...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="text-red-500 flex items-center">
        <span className="mr-2">❌</span>
        {errorMessage}
      </div>
    );
  }

  // Mostrar la fecha seleccionada de manera más clara
  const selectedDateFormatted = selectedDate 
    ? formatDateToSpanish(selectedDate)
    : 'Ninguna fecha seleccionada';

  return (
    <div className="delivery-date-picker space-y-4">
      {/* Fecha seleccionada actualmente */}
      <div className="p-2 bg-indigo-50 rounded-md">
        <p className="text-sm text-gray-600">Fecha de entrega seleccionada:</p>
        <p className="font-medium text-indigo-700">{selectedDateFormatted}</p>
      </div>
      
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
              selected={selectedDate}
              onChange={(date) => {
                handleDateChange(date);
                setCalendarOpen(false);
              }}
              filterDate={isDateAvailable}
              minDate={allPossibleDates[0]?.date}
              maxDate={allPossibleDates[allPossibleDates.length - 1]?.date}
              locale="es"
              inline
              monthsShown={1}
              className="border-0"
              popperModifiers={{
                preventOverflow: {
                  enabled: true,
                  boundariesElement: 'viewport'
                }
              }}
              dayClassName={(date) => {
                const baseClasses = 'text-center p-2 rounded-full transition-colors';
                
                if (selectedDate && isSameDay(date, selectedDate)) {
                  return `${baseClasses} bg-indigo-600 text-white`;
                }
                
                return isDateAvailable(date) 
                  ? `${baseClasses} hover:bg-indigo-100 cursor-pointer`
                  : `${baseClasses} bg-gray-100 text-gray-400 cursor-not-allowed`;
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
                <span className="w-3 h-3 inline-block bg-indigo-600 rounded-full mr-2"></span>
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
        Las entregas se procesan en días hábiles (lunes a sábado) y requieren mínimo 2 días de anticipación.
      </p>
    </div>
  );
};

export default DeliveryDatePicker;