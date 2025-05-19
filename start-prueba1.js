// Script para iniciar la versión Prueba1
// Este archivo ejecuta la versión de prueba en el puerto 5001

import { spawn } from 'child_process';

console.log('🧪 INICIANDO VERSIÓN DE PRUEBA 1 🧪');
console.log('Puerto: 5001');

// Iniciar el proceso con tsx para la versión de prueba
const prueba1Process = spawn('npx', ['tsx', 'server/index-prueba1.ts'], {
  stdio: 'inherit',
  shell: true
});

prueba1Process.on('close', (code) => {
  console.log(`Versión de prueba terminó con código: ${code}`);
});

// Manejar terminación del proceso
process.on('SIGINT', () => {
  console.log('Deteniendo versión de prueba...');
  prueba1Process.kill('SIGINT');
});