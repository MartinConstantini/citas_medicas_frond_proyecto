// src/interface/Usuario.ts
import type { UserRole } from "./Roles";

export interface Usuario {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  password?: string;
  rol: UserRole;
}
