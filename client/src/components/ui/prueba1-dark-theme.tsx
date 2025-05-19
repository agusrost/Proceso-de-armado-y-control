import { useEffect } from 'react';

/**
 * Componente que aplica automáticamente el tema oscuro a toda la aplicación
 * para la versión Prueba1
 */
export function Prueba1DarkTheme() {
  useEffect(() => {
    // Aplicar tema oscuro al cargar el componente
    const root = window.document.documentElement;
    
    // Primero eliminamos las clases de tema existentes
    root.classList.remove('light', 'dark');
    
    // Agregar la clase dark para activar el modo oscuro
    root.classList.add('dark');
    
    // Configurar colores de fondo adicionales para un tema uniforme
    document.body.style.backgroundColor = 'hsl(224, 71%, 4%)';
    document.body.style.color = 'hsl(213, 31%, 91%)';
    
    // Guardar el tema en localStorage para persistencia
    localStorage.setItem('konecta-theme', 'dark');
    
    // Agregar un identificador visual para la versión Prueba1
    const prueba1Badge = document.createElement('div');
    prueba1Badge.style.position = 'fixed';
    prueba1Badge.style.bottom = '10px';
    prueba1Badge.style.right = '10px';
    prueba1Badge.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    prueba1Badge.style.color = '#fff';
    prueba1Badge.style.padding = '5px 10px';
    prueba1Badge.style.borderRadius = '4px';
    prueba1Badge.style.fontSize = '12px';
    prueba1Badge.style.zIndex = '9999';
    prueba1Badge.textContent = 'PRUEBA1';
    
    // Solo agregar el badge si no existe ya
    if (!document.getElementById('prueba1-badge')) {
      prueba1Badge.id = 'prueba1-badge';
      document.body.appendChild(prueba1Badge);
    }
    
    // Limpiar al desmontar el componente
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
      const badge = document.getElementById('prueba1-badge');
      if (badge) {
        badge.remove();
      }
    };
  }, []);
  
  return null; // Este componente no renderiza nada visualmente
}