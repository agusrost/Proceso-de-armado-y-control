/**
 * Script para iniciar la versión de prueba
 * Este script ejecuta la versión "Prueba1" de la aplicación
 */

import { spawn } from 'child_process';
import path from 'path';

console.log('🧪 Iniciando versión PRUEBA1...');

// Configurar variables de entorno para la versión de prueba
const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: '5001',
  // Si tienes una base de datos de prueba diferente, puedes configurarla aquí
  // TEST_DATABASE_URL: '...'
};

// Iniciar el proceso con tsx
const tsPrueba = spawn('npx', ['tsx', 'server/index-prueba1.ts'], {
  env,
  stdio: 'inherit',
  shell: true
});

tsPrueba.on('close', (code) => {
  console.log(`Versión PRUEBA1 terminó con código ${code}`);
});

process.on('SIGINT', () => {
  console.log('Deteniendo versión PRUEBA1...');
  tsPrueba.kill('SIGINT');
});