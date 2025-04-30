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

export function formatDateTime(date: Date | string): string {
  if (!date) return "";
  const d = new Date(date);
  
  // Formato: YYYY-MM-DD HH:MM
  const dateStr = d.toISOString().split('T')[0];
  const timeStr = d.toTimeString().slice(0, 5);
  
  return `${dateStr} ${timeStr}`;
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

export function formatTimeHM(time: number | string | null | undefined): string {
  if (time === null || time === undefined) return "--:--:--";
  
  // Si ya es un string en formato HH:MM:SS o HH:MM
  if (typeof time === 'string') {
    const parts = time.split(':');
    if (parts.length === 3) {
      // Ya está en formato HH:MM:SS, lo devolvemos tal cual
      return time;
    } else if (parts.length === 2) {
      // Está en formato HH:MM, le añadimos los segundos (00)
      return `${time}:00`;
    }
    
    // Si es otro formato de string, intentamos parsear a número (segundos)
    const secs = parseInt(time);
    if (isNaN(secs)) return "--:--:--";
    
    // Calculamos horas, minutos y segundos
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');
  }
  
  // Si es un número, lo tratamos como segundos totales
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = time % 60;
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
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
    'pre-finalizado': 'Armado, pendiente Stock',
    'armado': 'Armado',
    'completado': 'Completado',
    'controlando': 'En Control',
    'controlado': 'Controlado',
    'finalizado': 'Finalizado',
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
    'armado': 'bg-green-500 text-white',
    'completado': 'bg-blue-600 text-white',
    'controlando': 'bg-violet-600 text-white',
    'controlado': 'bg-emerald-700 text-white',
    'finalizado': 'bg-emerald-800 text-white',
    'realizado': 'bg-green-500 text-white',
    'no-hay': 'bg-purple-500 text-white'
  };
  
  return colors[estado] || 'bg-gray-500 text-white';
}

export function generatePedidoId(id: number): string {
  return `PED-${id.toString().padStart(3, '0')}`;
}

export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

// Normalizar el código de producto para comparaciones
export function normalizeCode(code: string | number | null | undefined): string {
  if (code === null || code === undefined) return '';
  
  // Convertir a string y eliminar espacios
  let normalizedCode = String(code).trim().toLowerCase();
  
  // Eliminar caracteres no alfanuméricos al inicio o fin
  normalizedCode = normalizedCode.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  
  // Caso especial: los códigos 17061 y 18001 deben conservarse exactamente como están
  // para el pedido P0025
  if (normalizedCode === '17061' || normalizedCode === '18001') {
    console.log(`⚠️ Código especial detectado en normalización: ${normalizedCode}`);
    return normalizedCode;
  }
  
  // Para códigos numéricos, eliminar ceros a la izquierda
  if (/^\d+$/.test(normalizedCode)) {
    normalizedCode = String(parseInt(normalizedCode, 10));
  }
  
  return normalizedCode;
}

/**
 * Formatea un tiempo en segundos a una cadena legible formato "Xh Ym Zs"
 * Ejemplo: 3661 segundos -> "1h 1m 1s"
 * @param seconds Tiempo en segundos
 * @returns String formateado
 */
export function formatTimeDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  let result = "";
  
  if (hours > 0) {
    result += `${hours}h `;
  }
  
  if (minutes > 0 || hours > 0) {
    result += `${minutes}m `;
  }
  
  result += `${secs}s`;
  
  return result;
}
