// src/views/IndexPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import type { EventInput, EventApi, DateSelectArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPluginFC from "@fullcalendar/timegrid";
import jsPDF from "jspdf";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5005";

type Rol = "admin" | "medico" | "paciente";

type Usuario = {
  id: string;
  nombre: string;
  apaterno: string;
  amaterno?: string;
  correo: string;
  rol: Rol;
  telefono?: string;
  ciudad?: string;
  estado?: string;
  cedula?: string;
};

type Cita = {
  id: string;
  titulo: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  paciente: string;
  medico: string;
  notas?: string;
  estado: "pendiente" | "completada" | "cancelada" | string;
};

function getToken() {
  return localStorage.getItem("token");
}

function getPayload() {
  const token = getToken();
  if (!token) return null;
  try {
    const [, payloadBase64] = token.split(".");
    return JSON.parse(atob(payloadBase64));
  } catch {
    return null;
  }
}

type Section = "dashboard" | "citas" | "pacientes" | "medicos" | "reportes";

export default function IndexPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>("dashboard");

  const [citas, setCitas] = useState<Cita[]>([]);
  const [medicos, setMedicos] = useState<Usuario[]>([]);
  const [pacientes, setPacientes] = useState<Usuario[]>([]);
  const [query, setQuery] = useState("");
  const [selectedMedico, setSelectedMedico] = useState("");

  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCita, setEditingCita] = useState<Cita | null>(null);
  const [loading, setLoading] = useState(false);

  // Modales para usuarios
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalRol, setUserModalRol] = useState<Rol>("paciente");
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);

  const payload = getPayload();

  useEffect(() => {
    if (!payload) return;
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      const token = getToken();

      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [citasRes, medicosRes, pacientesRes] = await Promise.all([
        fetch(`${API_URL}/api/citas`, { headers }),
        fetch(`${API_URL}/api/usuarios/medicos`, { headers }),
        fetch(`${API_URL}/api/usuarios/pacientes`, { headers }),
      ]);

      const citasData = await citasRes.json();
      const medicosData = await medicosRes.json();
      const pacientesData = await pacientesRes.json();

      setCitas(Array.isArray(citasData) ? citasData : []);
      setMedicos(Array.isArray(medicosData) ? medicosData : []);
      setPacientes(Array.isArray(pacientesData) ? pacientesData : []);
    } catch (e) {
      console.error("Error cargando datos", e);
    } finally {
      setLoading(false);
    }
  }

  const events: EventInput[] = useMemo(() => {
    return citas.map((c) => {
      const start = new Date(`${c.fecha}T${c.hora}:00`);
      return {
        id: c.id,
        title: c.titulo,
        start: start.toISOString(),
        extendedProps: { ...c },
      };
    });
  }, [citas]);

  const filteredCitas = citas.filter((c) => {
    if (selectedMedico && c.medico !== selectedMedico) return false;
    if (query && !c.titulo.toLowerCase().includes(query.toLowerCase()))
      return false;
    return true;
  });

  function getNombreUsuario(id: string) {
    const u = [...medicos, ...pacientes].find((x) => x.id === id);
    if (!u) return id;
    return `${u.nombre} ${u.apaterno}`;
  }

  // ==== CITAS (ADMIN) ====

  function openNewCitaModal(selectInfo?: DateSelectArg) {
    const start = selectInfo ? selectInfo.startStr : new Date().toISOString();
    const d = start.slice(0, 10);
    const h = start.slice(11, 16);

    setEditingCita({
      id: "",
      titulo: "",
      fecha: d,
      hora: h,
      paciente: "",
      medico: "",
      notas: "",
      estado: "pendiente",
    });
    setModalOpen(true);
  }

  function openEditModal(event: EventApi) {
    const ext = event.extendedProps as any;
    setEditingCita({
      id: event.id,
      titulo: ext.titulo || event.title || "",
      fecha: ext.fecha,
      hora: ext.hora,
      paciente: ext.paciente,
      medico: ext.medico,
      notas: ext.notas || "",
      estado: ext.estado || "pendiente",
    });
    setModalOpen(true);
  }

  async function saveCita(cita: Cita) {
    try {
      const token = getToken();
      const method = cita.id ? "PUT" : "POST";
      const url =
        method === "POST"
          ? `${API_URL}/api/citas`
          : `${API_URL}/api/citas/${cita.id}`;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          titulo: cita.titulo,
          fecha: cita.fecha,
          hora: cita.hora,
          paciente: cita.paciente,
          medico: cita.medico,
          notas: cita.notas,
          estado: cita.estado,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al guardar la cita");
        return;
      }

      await cargarDatos();
      setModalOpen(false);
      setEditingCita(null);
    } catch (e) {
      console.error("Error guardando cita", e);
    }
  }

  async function deleteCita(id: string) {
    if (!confirm("¿Eliminar esta cita?")) return;
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/citas/${id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al eliminar la cita");
        return;
      }
      await cargarDatos();
      setModalOpen(false);
      setEditingCita(null);
    } catch (e) {
      console.error("Error eliminando cita", e);
    }
  }

  // ==== USUARIOS (PACIENTES / MEDICOS) ====

  function openUserModal(rol: Rol, user?: Usuario) {
    setUserModalRol(rol);
    setEditingUser(
      user || {
        id: "",
        nombre: "",
        apaterno: "",
        amaterno: "",
        correo: "",
        rol,
        telefono: "",
        ciudad: "",
        estado: "",
        cedula: "",
      }
    );
    setUserModalOpen(true);
  }

  async function saveUser() {
    if (!editingUser) return;
    const token = getToken();

    try {
      if (!editingUser.id) {
        // NUEVO: usamos /auth/register
        const res = await fetch(`${API_URL}/api/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nombre: editingUser.nombre,
            apaterno: editingUser.apaterno,
            amaterno: editingUser.amaterno || "",
            direccion: "",
            telefono: editingUser.telefono || "",
            ciudad: editingUser.ciudad || "",
            estado: editingUser.estado || "",
            rol: editingUser.rol,
            cedula: editingUser.cedula || "",
            correo: editingUser.correo,
            password: "123456",
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Error al crear usuario");
          return;
        }
      } else {
        // EDITAR: PUT /usuarios/:id
        const res = await fetch(`${API_URL}/api/usuarios/${editingUser.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            nombre: editingUser.nombre,
            apaterno: editingUser.apaterno,
            amaterno: editingUser.amaterno,
            correo: editingUser.correo,
            telefono: editingUser.telefono,
            ciudad: editingUser.ciudad,
            estado: editingUser.estado,
            cedula: editingUser.cedula,
            rol: editingUser.rol,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Error al actualizar usuario");
          return;
        }
      }

      await cargarDatos();
      setUserModalOpen(false);
      setEditingUser(null);
    } catch (e) {
      console.error("Error guardando usuario", e);
    }
  }

  async function deleteUsuario(id: string) {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/usuarios/${id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al eliminar usuario");
        return;
      }
      await cargarDatos();
    } catch (e) {
      console.error("Error eliminando usuario", e);
    }
  }

  // ==== LOGOUT ====

  async function handleLogout() {
    const token = getToken();
    try {
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (e) {
      console.error("Error cerrando sesión", e);
    } finally {
      localStorage.removeItem("token");
      navigate("/login");
    }
  }

  // ==== REPORTES ====

  function exportPDF() {
    const doc = new jsPDF();
    doc.text("Reporte de citas", 10, 10);
    citas.forEach((c, i) => {
      doc.text(
        `${i + 1}. ${c.fecha} ${c.hora} - ${c.titulo} - ${c.estado}`,
        10,
        20 + i * 8
      );
    });
    doc.save("reporte_citas.pdf");
  }

  function exportCSV() {
    const header = "titulo;fecha;hora;paciente;medico;estado\n";
    const rows = citas
      .map(
        (c) =>
          `"${c.titulo}";${c.fecha};${c.hora};"${getNombreUsuario(
            c.paciente
          )}";"${getNombreUsuario(c.medico)}";${c.estado}`
      )
      .join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte_citas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==== RENDER ====

  const citasHoy = citas.filter(
    (c) => c.fecha === new Date().toISOString().slice(0, 10)
  );

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-72 bg-gradient-to-b from-blue-900 to-sky-800 text-white hidden md:flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold">Clinica</h2>
          <p className="text-sm text-blue-100 mt-1">Panel de administración</p>
        </div>

        <nav className="p-4 space-y-2 text-sm">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "citas", label: "Citas" },
            { id: "pacientes", label: "Pacientes" },
            { id: "medicos", label: "Médicos" },
            { id: "reportes", label: "Reportes" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as Section)}
              className={`w-full text-left px-3 py-2 rounded cursor-pointer ${
                activeSection === item.id
                  ? "bg-white/20 font-semibold"
                  : "hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 text-xs text-blue-100 border-t border-white/10 space-y-2">
          <p>
            Usuario: <strong>{payload?.nombre || "Admin"}</strong>
          </p>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs font-semibold"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {activeSection === "dashboard" && "Dashboard"}
              {activeSection === "citas" && "Citas médicas"}
              {activeSection === "pacientes" && "Pacientes"}
              {activeSection === "medicos" && "Médicos"}
              {activeSection === "reportes" && "Reportes"}
            </h1>
            <p className="text-sm text-gray-500">
              {activeSection === "dashboard" &&
                "Resumen general del sistema de citas."}
              {activeSection === "citas" &&
                "Agenda y administración de citas médicas."}
              {activeSection === "pacientes" &&
                "Gestión de pacientes del sistema."}
              {activeSection === "medicos" && "Gestión de médicos."}
              {activeSection === "reportes" &&
                "Generación y consulta de reportes."}
            </p>
          </div>

          {activeSection === "citas" && (
            <div className="flex items-center gap-3">
              <input
                placeholder="Buscar cita..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="px-3 py-2 border rounded-lg outline-none bg-white shadow-sm"
              />

              <select
                value={selectedMedico}
                onChange={(e) => setSelectedMedico(e.target.value)}
                className="px-3 py-2 border rounded-lg outline-none bg-white shadow-sm"
              >
                <option value="">Todos los médicos</option>
                {medicos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {m.apaterno}
                  </option>
                ))}
              </select>

              <button
                onClick={() => openNewCitaModal()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold shadow"
              >
                + Nueva cita
              </button>
            </div>
          )}
        </header>

        {/* CONTENIDO POR SECCIÓN */}
        {activeSection === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500">Citas hoy</h3>
              <p className="text-2xl font-bold">{citasHoy.length}</p>
              {loading && (
                <p className="text-xs text-gray-400 mt-1">Actualizando...</p>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500 mb-2">Pacientes</h3>
              <p className="text-2xl font-bold">{pacientes.length}</p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500 mb-2">Médicos</h3>
              <p className="text-2xl font-bold">{medicos.length}</p>
            </div>
          </div>
        )}

        {activeSection === "citas" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista y stats */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white p-4 rounded-lg shadow-sm max-h-72 overflow-auto">
                <h3 className="text-sm text-gray-500 mb-2">Próximas</h3>
                <ul className="space-y-2">
                  {filteredCitas.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-medium">{c.titulo}</p>
                        <p className="text-gray-500">
                          {c.fecha} {c.hora}
                        </p>
                      </div>
                      <span className="text-gray-400">{c.estado}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Calendar */}
            <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow-sm">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPluginFC, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                selectable
                select={(info) => openNewCitaModal(info)}
                events={events}
                eventClick={(arg) => openEditModal(arg.event)}
                height={650}
              />
            </div>
          </div>
        )}

        {activeSection === "pacientes" && (
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Pacientes</h3>
              <button
                onClick={() => openUserModal("paciente")}
                className="px-3 py-1.5 rounded border text-blue-600 text-xs hover:bg-blue-50"
              >
                + Nuevo paciente
              </button>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-gray-600">
                    <th className="px-3 py-1 text-left">Nombre</th>
                    <th className="px-3 py-1 text-left">Correo</th>
                    <th className="px-3 py-1 text-left">Teléfono</th>
                    <th className="px-3 py-1 text-left">Ciudad</th>
                    <th className="px-3 py-1 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {pacientes.map((p) => (
                    <tr key={p.id} className="bg-gray-50 rounded border">
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-700">
                          {p.nombre} {p.apaterno}
                        </p>
                      </td>

                      <td className="px-3 py-2 text-gray-600">{p.correo}</td>
                      <td className="px-3 py-2 text-gray-600">{p.telefono}</td>
                      <td className="px-3 py-2 text-gray-600">{p.ciudad}</td>

                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openUserModal("paciente", p)}
                            className="px-2 py-1 rounded border text-blue-600 hover:bg-blue-50"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteUsuario(p.id)}
                            className="px-2 py-1 rounded border text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {activeSection === "medicos" && (
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Médicos</h3>
              <button
                onClick={() => openUserModal("medico")}
                className="px-3 py-1.5 rounded border text-blue-600 text-xs hover:bg-blue-50"
              >
                + Nuevo médico
              </button>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-gray-600">
                    <th className="px-3 py-1 text-left">Nombre</th>
                    <th className="px-3 py-1 text-left">Correo</th>
                    <th className="px-3 py-1 text-left">Cédula</th>
                    <th className="px-3 py-1 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {medicos.map((m) => (
                    <tr key={m.id} className="bg-gray-50 rounded border">
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-700">
                          {m.nombre} {m.apaterno}
                        </p>
                      </td>

                      <td className="px-3 py-2 text-gray-600">{m.correo}</td>
                      <td className="px-3 py-2 text-gray-600">{m.cedula}</td>

                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openUserModal("medico", m)}
                            className="px-2 py-1 rounded border text-blue-600 hover:bg-blue-50"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteUsuario(m.id)}
                            className="px-2 py-1 rounded border text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {activeSection === "reportes" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500">Total de citas</h3>
              <p className="text-2xl font-bold">{citas.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500">
                Citas completadas / pendientes
              </h3>
              <p className="text-sm mt-2">
                Completadas:{" "}
                {citas.filter((c) => c.estado === "completada").length} |{" "}
                Pendientes:{" "}
                {citas.filter((c) => c.estado === "pendiente").length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500">Exportar</h3>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={exportPDF}
                  className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
                >
                  PDF
                </button>
                <button
                  onClick={exportCSV}
                  className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
                >
                  CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal CRUD citas */}
        {isModalOpen && editingCita && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-lg rounded-lg p-6 shadow-xl text-sm">
              <h2 className="text-xl font-semibold mb-4">
                {editingCita.id ? "Editar cita" : "Nueva cita"}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Título */}
                <div className="md:col-span-2">
                  <label className="font-medium">Título</label>
                  <input
                    value={editingCita.titulo}
                    onChange={(e) =>
                      setEditingCita({ ...editingCita, titulo: e.target.value })
                    }
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>

                {/* Médico */}
                <div>
                  <label className="font-medium">Médico</label>
                  <select
                    value={editingCita.medico}
                    onChange={(e) =>
                      setEditingCita({ ...editingCita, medico: e.target.value })
                    }
                    className="border px-3 py-2 rounded w-full"
                  >
                    <option value="">Seleccione médico</option>
                    {medicos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} {m.apaterno}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Paciente */}
                <div>
                  <label className="font-medium">Paciente</label>
                  <select
                    value={editingCita.paciente}
                    onChange={(e) =>
                      setEditingCita({
                        ...editingCita,
                        paciente: e.target.value,
                      })
                    }
                    className="border px-3 py-2 rounded w-full"
                  >
                    <option value="">Seleccione paciente</option>
                    {pacientes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.apaterno}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fecha */}
                <div>
                  <label className="font-medium">Fecha</label>
                  <input
                    type="date"
                    value={editingCita.fecha}
                    onChange={(e) =>
                      setEditingCita({ ...editingCita, fecha: e.target.value })
                    }
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>

                {/* Hora */}
                <div>
                  <label className="font-medium">Hora</label>
                  <input
                    type="time"
                    value={editingCita.hora}
                    onChange={(e) =>
                      setEditingCita({ ...editingCita, hora: e.target.value })
                    }
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>

                {/* Estado */}
                <div>
                  <label className="font-medium">Estado</label>
                  <select
                    value={editingCita.estado}
                    onChange={(e) =>
                      setEditingCita({
                        ...editingCita,
                        estado: e.target.value as Cita["estado"],
                      })
                    }
                    className="border px-3 py-2 rounded w-full"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="completada">Completada</option>
                    <option value="cancelada">Cancelada / No asistió</option>
                  </select>
                </div>

                {/* Notas texto largo */}
                <div className="md:col-span-2">
                  <label className="font-medium">Notas</label>
                  <textarea
                    value={editingCita.notas || ""}
                    onChange={(e) =>
                      setEditingCita({ ...editingCita, notas: e.target.value })
                    }
                    className="border px-3 py-2 rounded w-full h-24"
                  />
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 mt-4">
                {editingCita.id && (
                  <button
                    onClick={() => deleteCita(editingCita.id)}
                    className="px-4 py-2 rounded border text-red-600"
                  >
                    Eliminar
                  </button>
                )}

                <button
                  onClick={() => {
                    setModalOpen(false);
                    setEditingCita(null);
                  }}
                  className="px-4 py-2 rounded border"
                >
                  Cancelar
                </button>

                <button
                  onClick={() => saveCita(editingCita)}
                  className="px-4 py-2 rounded bg-blue-600 text-white"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Modal USUARIO */}
        {userModalOpen && editingUser && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-lg rounded-lg p-6 shadow-xl text-sm">
              <h2 className="text-xl font-semibold mb-4">
                {editingUser.id
                  ? `Editar ${userModalRol}`
                  : `Nuevo ${userModalRol}`}
              </h2>

              {/* Compactado en 2 columnas por fila */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label>Nombre</label>
                  <input
                    value={editingUser.nombre}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        nombre: e.target.value,
                      })
                    }
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>

                <div>
                  <label>Apellido paterno</label>
                  <input
                    value={editingUser.apaterno}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        apaterno: e.target.value,
                      })
                    }
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>

                <div>
                  <label>Apellido materno</label>
                  <input
                    value={editingUser.amaterno || ""}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        amaterno: e.target.value,
                      })
                    }
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>

                <div>
                  <label>Correo</label>
                  <input
                    type="email"
                    value={editingUser.correo}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        correo: e.target.value,
                      })
                    }
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>

                <div>
                  <label>Teléfono</label>
                  <input
                    value={editingUser.telefono || ""}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        telefono: e.target.value,
                      })
                    }
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>

                <div>
                  <label>Ciudad</label>
                  <input
                    value={editingUser.ciudad || ""}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        ciudad: e.target.value,
                      })
                    }
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>

                <div>
                  <label>Estado</label>
                  <input
                    value={editingUser.estado || ""}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        estado: e.target.value,
                      })
                    }
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>

                {userModalRol === "medico" && (
                  <div>
                    <label>Cédula</label>
                    <input
                      value={editingUser.cedula || ""}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          cedula: e.target.value,
                        })
                      }
                      className="border px-3 py-2 rounded w-full"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setUserModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 rounded border"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveUser}
                  className="px-4 py-2 rounded bg-blue-600 text-white"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
