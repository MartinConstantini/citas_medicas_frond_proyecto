// src/views/DasboardPacientePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import FullCalendar from "@fullcalendar/react";
import type { EventInput, EventApi, DateSelectArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5005";

type Cita = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string;
  medico: string;
  paciente: string;
  notas?: string;
  estado: "pendiente" | "completada" | "cancelada" | string;
  resultado?: string; 
};

type Medico = {
  id: string;
  nombre: string;
  apaterno: string;
  correo: string;
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

export default function PacienteDashboard() {
  const navigate = useNavigate();
  const payload = getPayload();

  const [citas, setCitas] = useState<Cita[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Cita | null>(null);

  const eventos: EventInput[] = useMemo(
    () =>
      citas.map((cita) => ({
        id: cita.id,
        title: `${cita.titulo}`,
        start: new Date(`${cita.fecha}T${cita.hora}:00`).toISOString(),
        backgroundColor: cita.estado === "completada" ? "#22c55e" : "#3b82f6",
        borderColor: cita.estado === "completada" ? "#16a34a" : "#1d4ed8",
        extendedProps: { ...cita }, // incluye resultado
      })),
    [citas]
  );

  useEffect(() => {
    if (!payload) return;
    document.body.style.overflow = isOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen, payload]);

  useEffect(() => {
    if (!payload) return;
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarDatos() {
    if (!payload) return;
    try {
      const token = getToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [citasRes, medicosRes] = await Promise.all([
        fetch(`${API_URL}/api/citas/paciente/${payload.id}`, { headers }),
        fetch(`${API_URL}/api/usuarios/medicos`, { headers }),
      ]);
      const citasData = await citasRes.json();
      const medicosData = await medicosRes.json();
      setCitas(Array.isArray(citasData) ? citasData : []);
      setMedicos(Array.isArray(medicosData) ? medicosData : []);
    } catch (e) {
      console.error("Error cargando datos", e);
    }
  }

  function abrirNuevaCita(selectInfo?: DateSelectArg) {
    const start = selectInfo ? selectInfo.startStr : new Date().toISOString();
    const fecha = start.slice(0, 10);
    const hora = start.slice(11, 16);

    setEditing({
      id: "",
      titulo: "",
      fecha,
      hora,
      medico: "",
      paciente: payload?.id || "",
      notas: "",
      estado: "pendiente",
      resultado: "", // por defecto vacío
    });
    setIsOpen(true);
  }

  function abrirEditarCita(event: EventApi) {
    const ext = event.extendedProps as any;
    setEditing({
      id: event.id,
      titulo: ext.titulo || event.title,
      fecha: ext.fecha,
      hora: ext.hora,
      medico: ext.medico,
      paciente: ext.paciente,
      notas: ext.notas || "",
      estado: ext.estado || "pendiente",
      resultado: ext.resultado || "", // ← recogemos el resultado para mostrarlo
    });
    setIsOpen(true);
  }

  async function guardarCita() {
    if (!editing || !payload) return;
    const token = getToken();
    const method = editing.id ? "PUT" : "POST";
    const url =
      method === "POST"
        ? `${API_URL}/api/citas`
        : `${API_URL}/api/citas/${editing.id}`;

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        titulo: editing.titulo,
        fecha: editing.fecha,
        hora: editing.hora,
        medico: editing.medico,
        paciente: payload.id,
        notas: editing.notas,
        estado: editing.estado,
        // IMPORTANTE: NO mandamos resultado desde el paciente
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al guardar la cita");
      return;
    }

    await cargarDatos();
    setIsOpen(false);
    setEditing(null);
  }

  async function eliminarCita(id: string) {
    if (!confirm("¿Eliminar esta cita?")) return;
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
  }

  const generarPDF = () => {
    const pdf = new jsPDF();
    pdf.text("Mis Citas Médicas", 10, 10);

    citas.forEach((cita, index) => {
      pdf.text(
        `${index + 1}. ${cita.fecha} ${cita.hora} - ${cita.titulo} - ${
          cita.estado
        }${cita.resultado ? " - " + cita.resultado : ""}`,
        10,
        20 + index * 8
      );
    });

    pdf.save("mis_citas.pdf");
  };

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

  const nombrePaciente = payload?.nombre || "Paciente";

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-blue-700">Mis citas</h1>
          <p className="text-xs text-gray-500">
            Hola, {nombrePaciente}. Administra tus citas médicas.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="p-6 space-y-4">
        <div className="flex flex-wrap gap-4 mb-4">
          <button
            onClick={() => abrirNuevaCita()}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
          >
            Agendar cita
          </button>

          <button
            onClick={generarPDF}
            className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700"
          >
            Exportar PDF
          </button>
        </div>

        <div className="bg-white shadow p-4 rounded">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="700px"
            selectable
            events={eventos}
            select={(info) => abrirNuevaCita(info)}
            eventClick={(arg) => abrirEditarCita(arg.event)}
          />
        </div>

        <section className="mt-6 bg-white rounded shadow p-4">
          <h2 className="text_sm font-semibold mb-2 text-gray-700">
            Mis citas (lista)
          </h2>
          <ul className="space-y-2 text-xs">
            {citas.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between border-b last:border-b-0 pb-2 gap-4"
              >
                <div className="flex-1">
                  <p className="font-medium">{c.titulo}</p>
                  <p className="text-gray-500">
                    {c.fecha} {c.hora} - {c.estado}
                  </p>
                  {c.resultado && (
                    <p className="text-gray-600 mt-1">
                      <span className="font-semibold">Resultado:</span>{" "}
                      {c.resultado}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    className="px-2 py-1 rounded border text-blue-600"
                    onClick={() => {
                      setEditing(c);
                      setIsOpen(true);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className="px-2 py-1 rounded border text-red-600"
                    onClick={() => eliminarCita(c.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {isOpen && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-6 rounded shadow-lg w-96 z-[10000]">
            <h2 className="text-xl font-bold mb-4">
              {editing.id ? "Editar cita" : "Agendar nueva cita"}
            </h2>

            <form 
              onSubmit={(e) => {
                e.preventDefault(); 
                guardarCita();
              }}
            >
              <label className="block text-sm mb-1">Título / Motivo</label>
              <input
                type="text"
                className="border p-2 w-full mb-3"
                value={editing.titulo}
                onChange={(e) =>
                  setEditing({ ...editing, titulo: e.target.value })
                }
                required
              />

              <label className="block text-sm mb-1">Médico</label>
              <select
                className="border p-2 w-full mb-3"
                value={editing.medico}
                onChange={(e) =>
                  setEditing({ ...editing, medico: e.target.value })
                }
                required
              >
                <option value="">Seleccione médico</option>
                {medicos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {m.apaterno}
                  </option>
                ))}
              </select>

              <label className="block text-sm mb-1">Fecha</label>
              <input
                type="date"
                className="border p-2 w-full mb-3"
                value={editing.fecha}
                onChange={(e) =>
                  setEditing({ ...editing, fecha: e.target.value })
                }
                required
              />

              <label className="block text-sm mb-1">Hora</label>
              <input
                type="time"
                className="border p-2 w-full mb-3"
                value={editing.hora}
                onChange={(e) =>
                  setEditing({ ...editing, hora: e.target.value })
                }
                required
              />

              <label className="block text-sm mb-1">Notas</label>
              <textarea
                className="border p-2 w-full mb-3 h-20"
                value={editing.notas || ""}
                onChange={(e) =>
                  setEditing({ ...editing, notas: e.target.value })
                }
                required
              />

              {/* Resultado solo lectura para el paciente */}
              {editing.resultado && (
                <>
                  <label className="block text-sm mb-1">
                    Resultado del médico
                  </label>
                  <textarea
                    className="border p-2 w-full mb-3 h-20 bg-gray-50 text-gray-700"
                    value={editing.resultado}
                    readOnly
                  />
                </>
              )}

              <div className="flex gap-2 mb-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white w-full py-2 rounded"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setEditing(null);
                  }}
                  className="w-full py-2 rounded border"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
