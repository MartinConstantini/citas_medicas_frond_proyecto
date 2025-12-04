import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

// Base de la API: viene de VITE_API_URL o usa localhost por defecto
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5005";

function getPayload() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const [, payloadBase64] = token.split(".");
    return JSON.parse(atob(payloadBase64));
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Si ya hay sesión, redirigir
  useEffect(() => {
    const payload = getPayload();
    if (!payload) return;

    if (payload.rol === "admin") navigate("/admin/dashboard", { replace: true });
    else if (payload.rol === "paciente") navigate("/paciente", { replace: true });
    else if (payload.rol === "medico") navigate("/medico", { replace: true });
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Error al iniciar sesión");
        return;
      }

      // Guardar token
      localStorage.setItem("token", data.token);

      // Decodificar payload del JWT
      const [, payloadBase64] = data.token.split(".");
      const payload = JSON.parse(atob(payloadBase64));
      const rol = payload.rol;

      // Redirección según rol
      if (rol === "admin") navigate("/admin/dashboard");
      else if (rol === "paciente") navigate("/paciente");
      else if (rol === "medico") navigate("/medico");
      else navigate("/");

    } catch (error) {
      console.error(error);
      setErrorMsg("Error de conexión con el servidor");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
          Iniciar Sesión
        </h1>

        {errorMsg && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-3">
            {errorMsg}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="correo@correo.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-all"
          >
            Entrar
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          ¿No tienes cuenta?{" "}
          <a className="text-blue-600 font-semibold hover:underline" href="/register">
            Regístrate aquí
          </a>
        </p>
      </div>
    </div>
  );
}
