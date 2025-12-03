import type { Usuario } from './Usuario';

export interface Paciente extends Usuario {
  fechaNacimiento: string;
}
