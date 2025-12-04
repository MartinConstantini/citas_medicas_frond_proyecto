// src/views/DashboardDoctorPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import type { EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5005";

type Cita = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string;
  paciente: string;
  medico: string;
  notas?: string;
  estado: "pendiente" | "completada" | "cancelada" | string;
  resultado?: string; // ← NUEVO CAMPO EN EL TIPO
};

type Paciente = {
  id: string;
  nombre: string;
  apaterno: string;
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

export default function MedicoDashboard() {
  const navigate = useNavigate();
  const payload = getPayload();

  const [citas, setCitas] = useState<Cita[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [selected, setSelected] = useState<Cita | null>(null);

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [selected]);

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

      const [citasRes, pacientesRes] = await Promise.all([
        fetch(`${API_URL}/api/citas/medico/${payload.id}`, { headers }),
        fetch(`${API_URL}/api/usuarios/pacientes`, { headers }),
      ]);

      const citasData = await citasRes.json();
      const pacientesData = await pacientesRes.json();

      setCitas(citasData || []);
      setPacientes(pacientesData || []);
    } catch (e) {
      console.error("Error cargando datos médico", e);
    }
  }

  function getNombrePaciente(id: string) {
    const p = pacientes.find((x) => x.id === id);
    if (!p) return id;
    return `${p.nombre} ${p.apaterno}`;
  }

  const eventos: EventInput[] = useMemo(
    () =>
      citas.map((c) => ({
        id: c.id,
        title: `${c.titulo} - ${getNombrePaciente(c.paciente)}`,
        start: new Date(`${c.fecha}T${c.hora}:00`).toISOString(),
        backgroundColor: c.estado === "completada" ? "#16a34a" : "#2563eb",
        borderColor: c.estado === "completada" ? "#15803d" : "#1e40af",
        textColor: "#ffffff",
        extendedProps: { ...c }, // incluye resultado
      })),
    [citas, pacientes]
  );

  async function marcar(estado: "pendiente" | "completada" | "cancelada") {
    if (!selected) return;
    const token = getToken();
    const res = await fetch(`${API_URL}/api/citas/${selected.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        estado,
        resultado: selected.resultado ?? "", // ← mandamos también el resultado
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al actualizar cita");
      return;
    }

    await cargarDatos();
    setSelected(null);
  }

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

  const nombreMedico = payload?.nombre || "Médico";

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-blue-700">Citas del médico</h1>
          <p className="text-xs text-gray-500">
            Hola, {nombreMedico}. Aquí puedes gestionar tus citas.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="p-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={eventos}
            eventClick={(info) => {
              info.jsEvent.preventDefault();
              const ext = info.event.extendedProps as any;
              setSelected({
                id: info.event.id,
                titulo: ext.titulo || info.event.title,
                fecha: ext.fecha,
                hora: ext.hora,
                paciente: ext.paciente,
                medico: ext.medico,
                notas: ext.notas,
                estado: ext.estado,
                resultado: ext.resultado || "", // ← recogemos el resultado existente
              });
            }}
            height="650px"
            dayMaxEventRows={4}
          />
        </div>

        {/* Modal */}
        {selected && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            aria-modal="true"
            role="dialog"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={() => setSelected(null)}
            />

            <div
              className="relative bg-white w-full max-w-md mx-4 rounded-2xl shadow-2xl p-6 z-[10000] transform transition-all duration-200 ease-out"
              onClick={(e) => e.stopPropagation()}
              style={{ animation: "scaleIn .18s ease-out" }}
            >
              <header className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selected.titulo}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selected.fecha} {selected.hora}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Paciente: {getNombrePaciente(selected.paciente)}
                  </p>
                </div>

                <button
                  onClick={() => setSelected(null)}
                  className="text-gray-400 hover:text-gray-600 rounded p-1"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </header>

              <section className="mt-4 space-y-2 text-sm">
                <p className="text-gray-600">
                  Estado actual:{" "}
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      selected.estado === "completada"
                        ? "bg-green-100 text-green-800"
                        : selected.estado === "cancelada"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {selected.estado}
                  </span>
                </p>
                {selected.notas && (
                  <p className="text-gray-600">
                    Notas:{" "}
                    <span className="text-gray-800">{selected.notas}</span>
                  </p>
                )}

                {/* NUEVO: textarea para resultado */}
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Resultado de la cita
                  </label>
                  <textarea
                    className="w-full text-sm border rounded-lg p-2 min-h-[80px] resize-y bg-white"
                    placeholder="Escribe aquí el diagnóstico, tratamiento u observaciones..."
                    value={selected.resultado ?? ""}
                    onChange={(e) =>
                      setSelected((prev) =>
                        prev
                          ? { ...prev, resultado: e.target.value }
                          : prev
                      )
                    }
                  />
                </div>
              </section>

              <div className="mt-6 grid grid-cols-1 gap-3">
                <button
                  onClick={() => marcar("completada")}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white py-2 px-3 transition"
                >
                  Marcar como completada
                </button>

                <button
                  onClick={() => marcar("cancelada")}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-3 transition"
                >
                  Marcar como no asistió
                </button>

                <button
                  onClick={() => marcar("pendiente")}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 transition"
                >
                  Volver a pendiente
                </button>

                <button
                  onClick={() => setSelected(null)}
                  className="w-full rounded-lg border border-gray-200 text-gray-700 py-2 px-3"
                >
                  Cerrar
                </button>
              </div>

              <style>{`
                @keyframes scaleIn {
                  0% { opacity: 0; transform: translateY(6px) scale(.98); }
                  100% { opacity: 1; transform: translateY(0) scale(1); }
                }
              `}</style>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
