// src/router.tsx
import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import IndexPage from "./views/IndexPage";
import LoginPage from "./views/LoginPage";
import RegisterPage from "./views/RegisterPage";
import PacienteDashboard from "./views/DasboardPacientePage";
import ReportesPage from "./views/ReportesPage";
import MedicoDashboard from "./views/DashboardDoctorPage";

type Rol = "admin" | "medico" | "paciente";

function getPayload():
  | { id: string; rol: Rol; correo: string; nombre?: string }
  | null {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const [, payloadBase64] = token.split(".");
    return JSON.parse(atob(payloadBase64));
  } catch (e) {
    console.error("Error al decodificar token", e);
    return null;
  }
}

interface ProtectedRouteProps {
  allowedRoles: Rol[];
  children: ReactNode;
}

function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const payload = getPayload();

  if (!payload) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(payload.rol)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login como página principal */}
        <Route path="/" element={<LoginPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Dashboard ADMIN */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <IndexPage />
            </ProtectedRoute>
          }
        />

        {/* Dashboard MEDICO */}
        <Route
          path="/medico"
          element={
            <ProtectedRoute allowedRoles={["medico", "admin"]}>
              <MedicoDashboard />
            </ProtectedRoute>
          }
        />

        {/* Dashboard PACIENTE */}
        <Route
          path="/paciente"
          element={
            <ProtectedRoute allowedRoles={["paciente"]}>
              <PacienteDashboard />
            </ProtectedRoute>
          }
        />

        <Route
        path="/admin/reportes"
        element={
        <ProtectedRoute allowedRoles={["admin"]}>
        <ReportesPage />
        </ProtectedRoute>
         }
        />

        {/* Cualquier ruta desconocida → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

