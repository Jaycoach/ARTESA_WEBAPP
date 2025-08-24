import React, { useState, useEffect, useCallback, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from 'react-datepicker';
import es from 'date-fns/locale/es';
import { addDays, addMonths, isSameDay, format, parseISO } from 'date-fns';

registerLocale('es', es);

/**
 * Componente para seleccionar fecha de entrega según reglas de negocio y zonas de entrega
 * @param {Object} props - Props del componente
 * @param {string} props.value - Valor seleccionado
 * @param {function} props.onChange - Función para manejar cambios
 * @param {string} props.orderTimeLimit - Límite de tiempo para pedidos (formato "HH:MM")
 * @param {Array} props.availableDates - Fechas disponibles calculadas por el componente padre
 * @param {Object} props.deliveryZone - Zona de entrega seleccionada
 */
const DeliveryDatePicker = ({ 
  value, 
  onChange, 
  orderTimeLimit = "18:00",
  availableDates = [],
  deliveryZone = null
}) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const initialLoadRef = useRef(true);

  // Formateo consistente de fechas
  const formatDateToSpanish = (date) => {
    return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  };

  // Verificación de fecha disponible basada en las fechas proporcionadas por el padre
  const isDateAvailable = useCallback((date) => {
    if (!availableDates || availableDates.length === 0) return false;
    
    // Verificar que no sea domingo
    if (date.getDay() === 0) return false;
    
    return availableDates.some(availableDate => {
      // Normalizar ambas fechas para comparación sin zona horaria
      const normalizedAvailable = new Date(availableDate.getFullYear(), availableDate.getMonth(), availableDate.getDate());
      const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return normalizedAvailable.getTime() === normalizedDate.getTime();
    });
  }, [availableDates]);

  // Manejo consistente de cambios de fecha
  const handleDateChange = useCallback((date) => {
    if (!date) return;

    // Verificar que la fecha sea válida antes de proceder
    if (!isDateAvailable(date)) {
      setErrorMessage('La fecha seleccionada no está disponible para entrega');
      return;
    }

    // Crear fecha en zona horaria de Colombia para consistencia
    const colombianDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const formattedDate = format(colombianDate, 'yyyy-MM-dd');
    
    console.log(`Fecha seleccionada: ${formattedDate} (Colombia)`);
    
    setSelectedDate(date);
    onChange(formattedDate);
    setCalendarOpen(false);
    setErrorMessage('');
  }, [onChange, isDateAvailable]);

  // Efecto para sincronizar cuando cambia el valor externo
  useEffect(() => {
    if (value && value !== '') {
      try {
        const parsedDate = parseISO(value);
        
        // Normalizar fecha para comparación consistente independiente de zona horaria
        const normalizedParsedDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
        const isValid = availableDates.some(availableDate => {
          const normalizedAvailableDate = new Date(availableDate.getFullYear(), availableDate.getMonth(), availableDate.getDate());
          return normalizedAvailableDate.getTime() === normalizedParsedDate.getTime();
        });
        
        if (isValid) {
          setSelectedDate(parsedDate);
          setErrorMessage('');
        } else if (availableDates.length > 0) {
          // Si la fecha no es válida pero tenemos fechas disponibles,
          // seleccionar la primera fecha disponible
          console.warn('Fecha recibida no válida, usando primera fecha disponible');
          const newDate = new Date(availableDates[0]);
          setSelectedDate(newDate);
          onChange(format(newDate, 'yyyy-MM-dd'));
          setErrorMessage('');
        }
      } catch (error) {
        console.error('Error al procesar la fecha recibida:', error);
        setErrorMessage('Error al procesar la fecha seleccionada');
      }
    } else if (availableDates.length > 0 && initialLoadRef.current) {
      // Establecer fecha inicial solo en la primera carga
      const newDate = new Date(availableDates[0]);
      setSelectedDate(newDate);
      onChange(format(newDate, 'yyyy-MM-dd'));
      initialLoadRef.current = false;
      setErrorMessage('');
    }
  }, [value, availableDates, onChange]);

  // Efecto para limpiar fecha cuando cambia la zona de entrega
  useEffect(() => {
    if (deliveryZone) {
      // Reset cuando cambia la zona de entrega
      setSelectedDate(null);
      setErrorMessage('');
      initialLoadRef.current = true;
    }
  }, [deliveryZone]);

  // Renderizado condicional para cuando no hay fechas disponibles
  if (!availableDates || availableDates.length === 0) {
    return (
      <div className="w-full">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-center">
            <span className="text-yellow-500 mr-2">⚠️</span>
            <span className="text-sm text-yellow-700">
              {deliveryZone 
                ? `Calculando fechas disponibles para ${deliveryZone.name}...`
                : 'Selecciona una sucursal para ver las fechas de entrega disponibles'
              }
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Calcular información adicional para mostrar
  const selectedDateFormatted = selectedDate ? formatDateToSpanish(selectedDate) : 'Ninguna fecha seleccionada';
  const nextAvailableDates = availableDates.slice(0, 5); // Mostrar las próximas 5 fechas

  return (
    <div className="delivery-date-picker space-y-4">
      {/* Fecha seleccionada actualmente */}
      {selectedDate && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center mb-1">
            <span className="text-green-500 mr-2">✅</span>
            <span className="text-sm font-medium text-green-800">Fecha de entrega seleccionada:</span>
          </div>
          <p className="font-medium text-green-700">{selectedDateFormatted}</p>
          {deliveryZone && (
            <p className="text-sm text-green-600 mt-1">
              Zona: {deliveryZone.name}
            </p>
          )}
        </div>
      )}
      
      {/* Menú desplegable con botón para mostrar calendario */}
      <div className="relative">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setCalendarOpen(!calendarOpen)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {calendarOpen ? (
              <span className="flex items-center">
                <span className="mr-2">📅</span> Cerrar calendario
              </span>
            ) : (
              <span className="flex items-center">
                <span className="mr-2">📅</span> Seleccionar fecha
              </span>
            )}
          </button>
        </div>

        {/* Calendario desplegable */}
        {calendarOpen && (
          <div className="absolute z-20 mt-2 w-full bg-white rounded-md shadow-lg border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-gray-700">
                Selecciona fecha de entrega
                {deliveryZone && (
                  <span className="text-xs text-gray-500 block">
                    Zona: {deliveryZone.name}
                  </span>
                )}
              </h4>
              <button
                onClick={() => setCalendarOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              filterDate={isDateAvailable}
              minDate={availableDates[0] || new Date()}
              maxDate={addMonths(new Date(), 1)}
              locale="es"
              inline
              monthsShown={1}
              className="border-0"
              dayClassName={(date) => {
                const baseClasses = 'text-center p-2 rounded-full transition-colors text-sm';
                
                if (selectedDate && isSameDay(date, selectedDate)) {
                  return `${baseClasses} bg-green-600 text-white font-medium`;
                }
                
                if (isDateAvailable(date)) {
                  return `${baseClasses} hover:bg-blue-100 cursor-pointer text-gray-700 border border-transparent hover:border-blue-300`;
                }
                
                return `${baseClasses} bg-gray-100 text-gray-400 cursor-not-allowed`;
              }}
              renderCustomHeader={({
                date,
                decreaseMonth,
                increaseMonth,
                prevMonthButtonDisabled,
                nextMonthButtonDisabled,
              }) => (
                <div className="flex justify-between items-center px-2 py-2 mb-2">
                  <button
                    onClick={decreaseMonth}
                    disabled={prevMonthButtonDisabled}
                    className={`p-2 rounded-full ${prevMonthButtonDisabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    ←
                  </button>
                  <div className="text-sm font-medium text-gray-700 capitalize">
                    {date.toLocaleString('es', { month: 'long', year: 'numeric' })}
                  </div>
                  <button
                    onClick={increaseMonth}
                    disabled={nextMonthButtonDisabled}
                    className={`p-2 rounded-full ${nextMonthButtonDisabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    →
                  </button>
                </div>
              )}
            />

            {/* Leyenda del calendario */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex items-center">
                  <span className="w-3 h-3 inline-block bg-green-600 rounded-full mr-2"></span>
                  <span className="text-gray-600">Fecha seleccionada</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 inline-block bg-white border border-gray-300 rounded-full mr-2"></span>
                  <span className="text-gray-600">Fechas disponibles</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 inline-block bg-gray-100 rounded-full mr-2"></span>
                  <span className="text-gray-600">Fechas no disponibles</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fechas disponibles próximas como botones rápidos */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <h4 className="font-medium text-gray-700 mb-3 flex items-center">
          <span className="mr-2">📅</span>
          Fechas próximas disponibles
          {deliveryZone && (
            <span className="ml-2 text-sm text-gray-500">({deliveryZone.name})</span>
          )}
        </h4>
        
        <div className="grid grid-cols-1 gap-2">
          {nextAvailableDates.map((date, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleDateChange(date)}
              className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedDate && isSameDay(selectedDate, date)
                  ? 'bg-green-100 text-green-800 border border-green-300 font-medium'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              {formatDateToSpanish(date)}
            </button>
          ))}
        </div>
        
        {availableDates.length > 5 && (
          <p className="text-xs text-gray-500 mt-2 italic">
            Y {availableDates.length - 5} fechas más disponibles en el calendario...
          </p>
        )}
      </div>

      {/* Información adicional */}
      <div className="text-xs text-gray-500 space-y-1 bg-blue-50 p-3 rounded-md">
        <p className="flex items-center">
          <span className="mr-2">⏰</span>
          Las entregas se procesan en días hábiles (lunes a sábado)
        </p>
        <p className="flex items-center">
          <span className="mr-2">📋</span>
          Pedidos después de las {orderTimeLimit} requieren un día adicional de preparación
        </p>
        <p className="flex items-center">
          <span className="mr-2">🚫</span>
          No se realizan entregas los domingos
        </p>
        {deliveryZone && (
          <p className="flex items-center">
            <span className="mr-2">🚚</span>
            Entregas para {deliveryZone.name}: {deliveryZone.days.map(day => {
              const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
              return dayNames[day];
            }).join(', ')}
          </p>
        )}
      </div>

      {/* Mensaje de error */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">❌</span>
            <span className="text-sm text-red-700">{errorMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryDatePicker;