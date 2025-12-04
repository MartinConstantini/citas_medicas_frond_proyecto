import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

// Base de la API: viene de VITE_API_URL o usa localhost por defecto
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5005";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [rol, setRol] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [form, setForm] = useState({
    nombre: "",
    apaterno: "",
    amaterno: "",
    direccion: "",
    telefono: "",
    ciudad: "",
    estado: "",
    rol: "",
    cedula: "",
    correo: "",
    password: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    if (name === "rol") setRol(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrar");
        setLoading(false);
        return;
      }

      console.log("Usuario creado:", data);
      navigate("/login");
    } catch (err) {
      console.error(err);
      setError("Error de conexión con el servidor");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
          Crear Cuenta
        </h1>

        {error && (
          <div className="p-2 text-red-600 text-center font-semibold">
            {error}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          {[
            { label: "Nombre", name: "nombre" },
            { label: "Apellido paterno", name: "apaterno" },
            { label: "Apellido materno", name: "amaterno" },
            { label: "Dirección", name: "direccion" },
            { label: "Teléfono", name: "telefono" },
            { label: "Ciudad", name: "ciudad" },
            { label: "Estado", name: "estado" },
          ].map((item) => (
            <div key={item.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {item.label}
              </label>
              <input
                name={item.name}
                type="text"
                value={(form as any)[item.name]}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              name="rol"
              value={form.rol}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Selecciona un rol</option>
              <option value="paciente">Paciente</option>
              <option value="medico">Médico</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {rol === "medico" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cédula profesional
              </label>
              <input
                name="cedula"
                type="text"
                value={form.cedula}
                onChange={handleChange}
                placeholder="Número de cédula"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              name="correo"
              type="email"
              value={form.correo}
              onChange={handleChange}
              placeholder="correo@correo.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="********"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-all"
          >
            {loading ? "Creando cuenta..." : "Registrar"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
