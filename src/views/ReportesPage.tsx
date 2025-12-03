// src/views/ReportesPage.tsx
import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5005";

type Cita = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string;
  paciente: string;
  medico: string;
  estado: "pendiente" | "completada" | "cancelada" | string;
};

function getToken() {
  return localStorage.getItem("token");
}

export default function ReportesPage() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarCitas();
  }, []);

  async function cargarCitas() {
    try {
      setLoading(true);
      const token = getToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch(`${API_URL}/api/citas`, { headers });
      const data = await res.json();
      setCitas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error cargando reportes", e);
    } finally {
      setLoading(false);
    }
  }

  const totales = useMemo(() => {
    const total = citas.length;
    const completadas = citas.filter((c) => c.estado === "completada").length;
    const pendientes = citas.filter((c) => c.estado === "pendiente").length;
    const canceladas = citas.filter((c) => c.estado === "cancelada").length;
    return { total, completadas, pendientes, canceladas };
  }, [citas]);

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
          `"${c.titulo}";${c.fecha};${c.hora};${c.paciente};${c.medico};${c.estado}`
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

  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500">
            Estadísticas generales de las citas médicas.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportPDF}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
          >
            Exportar PDF
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 rounded bg-gray-200 text-sm"
          >
            Exportar CSV
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow-sm">
          <p className="text-xs text-gray-500">Total de citas</p>
          <p className="text-2xl font-bold">{totales.total}</p>
        </div>
        <div className="bg-white p-4 rounded shadow-sm">
          <p className="text-xs text-gray-500">Completadas</p>
          <p className="text-2xl font-bold text-emerald-600">
            {totales.completadas}
          </p>
        </div>
        <div className="bg-white p-4 rounded shadow-sm">
          <p className="text-xs text-gray-500">Pendientes</p>
          <p className="text-2xl font-bold text-blue-600">
            {totales.pendientes}
          </p>
        </div>
        <div className="bg-white p-4 rounded shadow-sm">
          <p className="text-xs text-gray-500">Canceladas</p>
          <p className="text-2xl font-bold text-red-500">
            {totales.canceladas}
          </p>
        </div>
      </section>

      <section className="bg-white rounded shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Citas recientes
          </h2>
          {loading && (
            <span className="text-xs text-gray-400">Actualizando...</span>
          )}
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="min-w-full border divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left">Fecha</th>
                <th className="px-2 py-2 text-left">Hora</th>
                <th className="px-2 py-2 text-left">Título</th>
                <th className="px-2 py-2 text-left">Paciente</th>
                <th className="px-2 py-2 text-left">Médico</th>
                <th className="px-2 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {citas.slice(0, 50).map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-2 py-2">{c.fecha}</td>
                  <td className="px-2 py-2">{c.hora}</td>
                  <td className="px-2 py-2">{c.titulo}</td>
                  <td className="px-2 py-2">{c.paciente}</td>
                  <td className="px-2 py-2">{c.medico}</td>
                  <td className="px-2 py-2">{c.estado}</td>
                </tr>
              ))}
              {citas.length === 0 && !loading && (
                <tr>
                  <td
                    className="px-2 py-4 text-center text-gray-400"
                    colSpan={6}
                  >
                    No hay citas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
