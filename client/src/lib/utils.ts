import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { AccessPermission, UserRole } from "@shared/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}

export function formatTimeHM(seconds: number | string | null | undefined): string {
  if (seconds === null || seconds === undefined) return "--:--";
  
  // Si es un string, intentamos parsear a número
  const secs = typeof seconds === 'string' ? parseInt(seconds) : seconds;
  
  // Si no es un número válido después de parsear
  if (isNaN(secs)) return "--:--";
  
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0')
  ].join(':');
}

export function getRoleLabel(role: UserRole): string {
  const roles: Record<UserRole, string> = {
    'admin-plus': 'Admin Plus',
    'admin-gral': 'Admin Gral',
    'stock': 'Stock',
    'armador': 'Armador',
    'control': 'Control'
  };
  
  return roles[role] || 'Usuario';
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    'admin-plus': 'bg-primary text-primary-foreground',
    'admin-gral': 'bg-blue-600 text-white',
    'stock': 'bg-indigo-500 text-white',
    'armador': 'bg-orange-500 text-white',
    'control': 'bg-emerald-600 text-white'
  };
  
  return colors[role] || 'bg-gray-500 text-white';
}

export function getAccessLabel(access: AccessPermission): string {
  const labels: Record<AccessPermission, string> = {
    'pedidos': 'Pedidos',
    'stock': 'Stock',
    'control': 'Control',
    'config': 'Configuración'
  };
  
  return labels[access];
}

export function getEstadoLabel(estado: string): string {
  const estados: Record<string, string> = {
    'pendiente': 'Pendiente',
    'en-proceso': 'En Proceso',
    'pre-finalizado': 'Pre-finalizado, falta transferencia',
    'completado': 'Completado',
    'realizado': 'Realizado',
    'no-hay': 'No hay, realizar NC'
  };
  
  return estados[estado] || estado;
}

export function getEstadoColor(estado: string): string {
  const colors: Record<string, string> = {
    'pendiente': 'bg-orange-500 text-white',
    'en-proceso': 'bg-blue-500 text-white',
    'pre-finalizado': 'bg-amber-500 text-white',
    'completado': 'bg-green-500 text-white',
    'realizado': 'bg-green-500 text-white',
    'no-hay': 'bg-purple-500 text-white'
  };
  
  return colors[estado] || 'bg-gray-500 text-white';
}

export function generatePedidoId(id: number): string {
  return `PED-${id.toString().padStart(3, '0')}`;
}
