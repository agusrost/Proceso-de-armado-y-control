/**
 * Utilitarios para la normalización y comparación de códigos de productos
 * Centraliza la lógica de comparación para usarla en todos los módulos
 */

// Lista de códigos especiales conocidos que requieren tratamiento específico
const CODIGOS_ESPECIALES = ['17061', '18001', '17133'];

/**
 * Normaliza un código de producto para facilitar comparaciones entre distintos formatos
 * @param code Código a normalizar (puede ser string, número o undefined)
 * @returns Código normalizado como string
 */
export function normalizeCode(code: string | number | null | undefined): string {
  if (code === null || code === undefined) return '';
  
  // Convertir a string y eliminar espacios
  let normalizedCode = String(code).trim().toLowerCase().replace(/\s+/g, '');
  
  // Guardar una versión original trimmeada para casos especiales
  const trimmedCode = normalizedCode;
  
  // Eliminar caracteres no alfanuméricos al inicio o fin
  normalizedCode = normalizedCode.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  
  // Verificar códigos especiales (preserva el valor exacto para ciertos códigos)
  if (CODIGOS_ESPECIALES.includes(normalizedCode) || CODIGOS_ESPECIALES.includes(trimmedCode)) {
    const codigoOriginal = CODIGOS_ESPECIALES.find(c => c === normalizedCode || c === trimmedCode) || normalizedCode;
    console.log(`⚠️ Código especial detectado en normalización: ${codigoOriginal} - ¡Preservando valor exacto!`);
    return codigoOriginal;
  }
  
  // Verificar si es un código numérico que empieza con ceros
  const numericWithLeadingZeros = /^0+\d+$/.test(normalizedCode);
  if (numericWithLeadingZeros) {
    // Preservar la versión original con ceros para comparar exactamente después
    console.log(`Detectado código con ceros iniciales: ${normalizedCode}`);
    return normalizedCode;
  }
  
  // Para códigos numéricos normales, eliminar ceros a la izquierda
  if (/^\d+$/.test(normalizedCode)) {
    normalizedCode = String(parseInt(normalizedCode, 10));
  }
  
  return normalizedCode;
}

/**
 * Compara dos códigos para determinar si son equivalentes
 * @param code1 Primer código a comparar
 * @param code2 Segundo código a comparar
 * @param pedidoId Opcional, ID del pedido para manejo específico de ciertos códigos
 * @returns true si los códigos son equivalentes
 */
export function areCodesEquivalent(
  code1: string | number | null | undefined, 
  code2: string | number | null | undefined,
  pedidoId?: string | number
): boolean {
  if ((code1 === null || code1 === undefined) && (code2 === null || code2 === undefined)) {
    return true; // Ambos son nulos o undefined
  }
  
  if (code1 === null || code1 === undefined || code2 === null || code2 === undefined) {
    return false; // Solo uno es nulo o undefined
  }
  
  // Convertir a strings para comparación básica directa
  const strCode1 = String(code1).trim();
  const strCode2 = String(code2).trim();
  
  // Caso especial para ciertos pedidos
  const esPedidoEspecial = pedidoId === 23 || pedidoId === '23' || pedidoId === 'P0025';
  
  console.log(`Comparando códigos: "${strCode1}" con "${strCode2}" ${esPedidoEspecial ? '(Pedido Especial P0025)' : ''}`);
  
  // CASO SUPER ESPECIAL PARA EL CÓDIGO 17061 en P0025
  if (esPedidoEspecial && (strCode1 === '17061' || strCode2 === '17061')) {
    console.log(`⚠️⚠️⚠️ CASO SÚPER ESPECIAL PARA EL CÓDIGO 17061 ⚠️⚠️⚠️`);
    if (strCode1 === '17061' && strCode2 === '17061') {
      console.log(`✓✓✓ COINCIDENCIA EXACTA para código especial 17061 en P0025`);
      return true;
    }
    if ((strCode1 === '17061' && normalizeCode(strCode2) === '17061') || 
        (strCode2 === '17061' && normalizeCode(strCode1) === '17061')) {
      console.log(`✓✓✓ COINCIDENCIA NORMALIZADA para código especial 17061 en P0025`);
      return true;
    }
  }
  
  // 0. Comparación exacta sin normalizar (útil para códigos especiales)
  if (strCode1 === strCode2) {
    console.log(`✓ Coincidencia exacta sin normalizar: "${strCode1}" === "${strCode2}"`);
    return true;
  }
  
  // Manejo especial para códigos conocidos en el pedido P0025 (id 23)
  if (esPedidoEspecial) {
    // Verificar códigos especiales directamente
    if (CODIGOS_ESPECIALES.includes(strCode1) && CODIGOS_ESPECIALES.includes(strCode2)) {
      if (strCode1 === strCode2) {
        console.log(`✓ Caso especial en P0025: códigos especiales "${strCode1}" coinciden exactamente`);
        return true;
      }
    }
    
    // Si uno de los códigos es especial, verificar coincidencia exacta
    if (CODIGOS_ESPECIALES.includes(strCode1) || CODIGOS_ESPECIALES.includes(strCode2)) {
      if (strCode1 === '17061' && strCode2 === '17061') {
        console.log(`✓ Coincidencia exacta para código especial 17061 en P0025`);
        return true;
      }
      if (strCode1 === '18001' && strCode2 === '18001') {
        console.log(`✓ Coincidencia exacta para código especial 18001 en P0025`);
        return true;
      }
    }
    
    // Comparación numérica para códigos en P0025 si ambos son números
    if (!isNaN(Number(strCode1)) && !isNaN(Number(strCode2))) {
      if (Number(strCode1) === Number(strCode2)) {
        console.log(`✓ Caso especial (numérico) en P0025: ${Number(strCode1)} === ${Number(strCode2)}`);
        return true;
      }
    }
  }
  
  // A partir de aquí usamos los códigos normalizados
  const normalizedCode1 = normalizeCode(code1);
  const normalizedCode2 = normalizeCode(code2);
  
  console.log(`Códigos normalizados: "${normalizedCode1}" con "${normalizedCode2}"`);
  
  // 1. Comparación normalizada
  if (normalizedCode1 === normalizedCode2) {
    console.log(`✓ Coincidencia normalizada: "${normalizedCode1}" === "${normalizedCode2}"`);
    return true;
  }
  
  // 2. Comparación numérica si ambos son números
  if (!isNaN(Number(normalizedCode1)) && !isNaN(Number(normalizedCode2))) {
    if (Number(normalizedCode1) === Number(normalizedCode2)) {
      console.log(`✓ Coincidencia numérica: ${Number(normalizedCode1)} === ${Number(normalizedCode2)}`);
      return true;
    }
  }
  
  // 3. Comparación de prefijos
  if (normalizedCode1.startsWith(normalizedCode2) || normalizedCode2.startsWith(normalizedCode1)) {
    console.log(`✓ Coincidencia de prefijo: "${normalizedCode1}" ~ "${normalizedCode2}"`);
    return true;
  }
  
  // 4. Eliminar caracteres no alfanuméricos y comparar
  const cleanCode1 = normalizedCode1.replace(/[^a-z0-9]/g, '');
  const cleanCode2 = normalizedCode2.replace(/[^a-z0-9]/g, '');
  
  if (cleanCode1 === cleanCode2) {
    console.log(`✓ Coincidencia limpia: "${cleanCode1}" === "${cleanCode2}"`);
    return true;
  }
  
  // 5. Verificar sufijos o prefijos numéricos (ej: cuando uno tiene ceros a la izquierda que no se eliminaron)
  if (/^\d+$/.test(cleanCode1) && /^\d+$/.test(cleanCode2)) {
    // Quitar ceros a la izquierda para comparación final
    const numCode1 = String(parseInt(cleanCode1, 10));
    const numCode2 = String(parseInt(cleanCode2, 10));
    
    if (numCode1 === numCode2) {
      console.log(`✓ Coincidencia numérica sin ceros: "${numCode1}" === "${numCode2}"`);
      return true;
    }
  }
  
  console.log(`✗ No se encontró coincidencia entre "${code1}" y "${code2}"`);
  return false;
}