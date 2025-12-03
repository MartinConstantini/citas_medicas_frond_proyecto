import type { Usuario } from "./Usuario";

export interface Medico extends Usuario {
  especialidad: string;
  horarioAtencion: { dia: number; inicio: string; fin: string }[];
}
