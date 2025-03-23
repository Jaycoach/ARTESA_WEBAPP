import React, { useState, useEffect } from 'react';
import API from '../../../../api/config';
import { useAuth } from '../../../../hooks/useAuth';

const Settings = () => {
    const { user } = useAuth();
    const [userData, setUserData] = useState({
        nombre: "",
        email: "",
        telefono: "",
        direccion: "",
        ciudad: "",
        identificacion: "",
        razonSocial: "",
        cupoActual: "",
        cupoSolicitado: ""
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Estado para el formulario de cambio de contraseña
const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Manejador de cambio en inputs
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };
  
  // Función para enviar la actualización
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
  
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage('Las contraseñas no coinciden.');
      return;
    }
  
    try {
      setPasswordLoading(true);
      setPasswordMessage('');
  
      const response = await API.put(`/auth/change-password`, {
        userId: user.id,
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
  
      if (response.data.success) {
        setPasswordMessage('Contraseña actualizada correctamente.');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordMessage(response.data.message || 'Error al actualizar la contraseña.');
      }
    } catch (err) {
      setPasswordMessage('Error en la solicitud. Intenta más tarde.');
    } finally {
      setPasswordLoading(false);
    }
  };

    useEffect(() => {
        const fetchUserData = async () => {
            setLoading(true);
            setError('');
            try {
                if (!user || !user.id) {
                    console.warn("No se ha encontrado el ID del usuario.");
                    setError("No se ha encontrado el ID del usuario.");
                    return;
                }
                const userId = user.id;
                const response = await API.get(`/client-profiles/user/${userId}`);

                if (response.status !== 200) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                if (!response.data || !response.data.data) {
                    throw new Error("No se recibieron datos del usuario.");
                }

                setUserData(response.data.data);
            } catch (error) {
                console.error("Error obteniendo datos del usuario:", error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [user?.id]);

    return (
        <div className="max-w-screen-lg mx-auto p-6">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Configuración</h2>

            {/* Mensajes de estado */}
            {loading && <p className="text-blue-500 text-center">Cargando...</p>}
            {error && <p className="text-red-500 bg-red-100 p-2 rounded text-center">{error}</p>}

            {/* Información del Usuario */}
            <section className="bg-white shadow-lg rounded-lg p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-600 mb-4 text-center">Información del Usuario</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded-lg">
                        <tbody>
                            <tr className="border-b">
                                <td className="px-4 py-2 font-medium text-gray-600">Nombre:</td>
                                <td className="px-4 py-2 text-gray-700">{userData.nombre || "N/A"}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="px-4 py-2 font-medium text-gray-600">Email:</td>
                                <td className="px-4 py-2 text-gray-700">{userData.email || "N/A"}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="px-4 py-2 font-medium text-gray-600">Teléfono:</td>
                                <td className="px-4 py-2 text-gray-700">{userData.telefono || "N/A"}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="px-4 py-2 font-medium text-gray-600">Dirección:</td>
                                <td className="px-4 py-2 text-gray-700">{userData.direccion || "N/A"}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="px-4 py-2 font-medium text-gray-600">Ciudad:</td>
                                <td className="px-4 py-2 text-gray-700">{userData.ciudad || "N/A"}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="px-4 py-2 font-medium text-gray-600">Identificación:</td>
                                <td className="px-4 py-2 text-gray-700">{userData.identificacion || "N/A"}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="px-4 py-2 font-medium text-gray-600">Razón Social:</td>
                                <td className="px-4 py-2 text-gray-700">{userData.razonSocial || "N/A"}</td>
                            </tr>
                            <tr className="border-b">
                                <td className="px-4 py-2 font-medium text-gray-600">Cupo Actual:</td>
                                <td className="px-4 py-2 text-gray-700">{userData.cupoActual || "N/A"}</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-2 font-medium text-gray-600">Cupo Solicitado:</td>
                                <td className="px-4 py-2 text-gray-700">{userData.cupoSolicitado || "N/A"}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="bg-white shadow-lg rounded-lg p-6">
  <h3 className="text-xl font-semibold text-gray-600 mb-4 text-center">Actualizar Contraseña</h3>

  {passwordMessage && (
    <div className="text-center mb-4 text-sm text-red-600">{passwordMessage}</div>
  )}

  <form onSubmit={handlePasswordSubmit} className="space-y-4">
    <div>
      <label className="block text-gray-600 font-medium">Contraseña actual</label>
      <input
        type="password"
        name="currentPassword"
        value={passwordData.currentPassword}
        onChange={handlePasswordChange}
        className="w-full mt-1 px-4 py-2 border rounded-lg"
        required
      />
    </div>
    <div>
      <label className="block text-gray-600 font-medium">Nueva contraseña</label>
      <input
        type="password"
        name="newPassword"
        value={passwordData.newPassword}
        onChange={handlePasswordChange}
        className="w-full mt-1 px-4 py-2 border rounded-lg"
        required
      />
    </div>
    <div>
      <label className="block text-gray-600 font-medium">Confirmar nueva contraseña</label>
      <input
        type="password"
        name="confirmPassword"
        value={passwordData.confirmPassword}
        onChange={handlePasswordChange}
        className="w-full mt-1 px-4 py-2 border rounded-lg"
        required
      />
    </div>
    <div className="text-center">
      <button
        type="submit"
        disabled={passwordLoading}
        className="bg-accent text-gray-50 px-6 py-2 rounded-md hover:bg-secondary transition"
      >
        {passwordLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
      </button>
    </div>
  </form>
</section>
            
        </div>
    );
};

export default Settings;