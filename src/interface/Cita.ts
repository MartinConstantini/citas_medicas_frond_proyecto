// src/interface/Cita.ts
export interface Cita {
  id: string;
  titulo: string;
  fecha: string;
  hora: string;
  paciente: string;
  medico: string;
  notas?: string;
  estado: "pendiente" | "completada" | "cancelada";
  resultado?: string; // ← NUEVO CAMPO
  createdAt?: string;
}
