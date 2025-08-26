// components/Dashboard/Top.jsx - REFACTORIZADO SIN AFECTAR ESTILO
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaUserCircle, FaBell, FaBars } from "react-icons/fa";
import logoArtesa from '../../../../LoginsAssets/logo_artesa_blanco.png';
import { useAuth } from "../../../../hooks/useAuth";
import ClientProfile from "../../ClientProfile/ClientProfile";

const Top = ({ user, onToggleSidebar }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const { logout, updateUserInfo, updateBranchInfo, authType, branch } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const profileModalRef = useRef(null);

  useEffect(() => {
    let name = "Usuario";

    if (authType === 'branch' && branch) {
      name = branch.branchname || branch.branch_name || branch.manager_name || branch.email || "Sucursal";
    } else if (user) {
      name = user.nombre || user.name || user.email || user.mail || "Usuario";
    }

    setDisplayName(name);
  }, [user, branch, authType]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
      if (showProfileModal && profileModalRef.current && !profileModalRef.current.contains(event.target)) {
        setShowProfileModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen, showProfileModal]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => {
    setMenuOpen(false);
    setShowProfileModal(true);
  };

  const handleCloseProfile = () => {
    setShowProfileModal(false);
  };

  const handleProfileUpdate = (updatedData) => {
    if (authType === 'branch') {
      updateBranchInfo(updatedData);
    } else {
      updateUserInfo(updatedData);
    }
  };

  const getDashboardRoute = () => {
    return authType === 'branch' ? '/dashboard-branch' : '/dashboard';
  };

  return (
    <div className="bg-primary text-white h-14 px-7 flex items-center justify-between shadow-md z-30">
      <div className="flex items-center">
        <button
          onClick={onToggleSidebar}
          className="mr-4 text-white hover:text-gray-200 focus:outline-none"
        >
          <FaBars />
        </button>
        <Link to={getDashboardRoute()}>
          <img
            src={logoArtesa}
            alt="Logo de LA ARTESA"
            className="h-16 object-contain ml-[2px]"
          />
        </Link>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center space-x-2 text-white hover:text-gray-200"
        >
          <span className="mr-2">{displayName}</span>
          <FaUserCircle size={24} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
            <button
              onClick={handleOpenProfile}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Mi Perfil
            </button>
            {authType !== 'branch' && (
              <button
                onClick={() => navigate("/dashboard/settings")}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Configuración
              </button>
            )}
            <div className="border-t border-gray-100 my-1"></div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>

      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            ref={profileModalRef}
            className="bg-white rounded-lg shadow-xl w-full max-w-md m-4 p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {authType === 'branch' ? 'Perfil de Sucursal' : 'Mi Perfil'}
              </h2>
              <button
                onClick={handleCloseProfile}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                ✕
              </button>
            </div>

            {authType === 'branch' && branch ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre de Sucursal
                    </label>
                    <div className="p-2 bg-gray-50 rounded border text-sm text-gray-800">
                      {branch.branchname || branch.branch_name || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Manager
                    </label>
                    <div className="p-2 bg-gray-50 rounded border text-sm text-gray-800">
                      {branch.manager_name || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <div className="p-2 bg-gray-50 rounded border text-sm text-gray-800">
                      {branch.email || branch.email_branch || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Empresa
                    </label>
                    <div className="p-2 bg-gray-50 rounded border text-sm text-gray-800">
                      {branch.company_name || 'N/A'}
                    </div>
                  </div>

                  {branch.address && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dirección
                      </label>
                      <div className="p-2 bg-gray-50 rounded border text-sm text-gray-800">
                        {branch.address}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <button
                    onClick={handleCloseProfile}
                    className="w-full bg-primary text-white py-2 px-4 rounded hover:bg-primary-600 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <ClientProfile
                onClose={handleCloseProfile}
                onProfileUpdate={handleProfileUpdate}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Top;