// Este script permite activar el tema oscuro basado en la ruta URL
// Usado para la versión "Prueba1"

// Función para aplicar el tema oscuro
function applyDarkTheme() {
  console.log('🌙 Aplicando tema oscuro para versión PRUEBA1');
  
  // Cambiar el tema a oscuro
  document.documentElement.classList.remove('light');
  document.documentElement.classList.add('dark');
  
  // Establecer color de fondo oscuro
  document.body.style.backgroundColor = 'hsl(224, 71%, 4%)';
  document.body.style.color = 'hsl(213, 31%, 91%)';
  
  // Guardar preferencia en localStorage
  localStorage.setItem('konecta-theme', 'dark');
  
  // Agregar un badge indicador de versión "Prueba1"
  const prueba1Badge = document.createElement('div');
  prueba1Badge.id = 'prueba1-badge';
  prueba1Badge.style.position = 'fixed';
  prueba1Badge.style.bottom = '10px';
  prueba1Badge.style.right = '10px';
  prueba1Badge.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  prueba1Badge.style.color = '#fff';
  prueba1Badge.style.padding = '5px 10px';
  prueba1Badge.style.borderRadius = '4px';
  prueba1Badge.style.fontSize = '12px';
  prueba1Badge.style.fontWeight = 'bold';
  prueba1Badge.style.zIndex = '9999';
  prueba1Badge.textContent = 'PRUEBA1';
  
  // Solo agregar el badge si no existe ya
  if (!document.getElementById('prueba1-badge')) {
    document.body.appendChild(prueba1Badge);
  }
  
  // Agregar estilos adicionales para componentes específicos
  const styleEl = document.createElement('style');
  styleEl.id = 'prueba1-styles';
  styleEl.textContent = `
    /* Estilos para tema oscuro en Prueba1 */
    .bg-background, [class*="bg-background"] {
      background-color: hsl(224, 71%, 4%) !important;
    }
    .bg-card, [class*="bg-card"] {
      background-color: hsl(224, 71%, 8%) !important;
    }
    /* Destacar encabezados */
    h1, h2, h3, h4, h5, h6 {
      color: hsl(210, 100%, 80%) !important;
    }
    
    /* Cambios en botones y controles */
    button, .btn, [class*="btn-"] {
      filter: brightness(0.85);
    }
    
    /* Inversión de colores para iconos */
    svg:not([class*="text-"]) {
      filter: brightness(1.5);
    }
    
    /* Mejorar contraste en tablas */
    table, th, td {
      border-color: rgba(255, 255, 255, 0.1) !important;
    }
    
    /* Mejorar inputs */
    input, select, textarea {
      background-color: hsl(224, 30%, 12%) !important;
      color: hsl(210, 40%, 98%) !important;
      border-color: hsl(215, 20%, 30%) !important;
    }
  `;
  
  // Solo agregar los estilos si no existen ya
  if (!document.getElementById('prueba1-styles')) {
    document.head.appendChild(styleEl);
  }
}

// Función para restaurar el tema normal
function restoreLightTheme() {
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.add('light');
  document.body.style.backgroundColor = '';
  document.body.style.color = '';
  
  // Remover badge
  const badge = document.getElementById('prueba1-badge');
  if (badge) {
    badge.remove();
  }
  
  // Remover estilos adicionales
  const styles = document.getElementById('prueba1-styles');
  if (styles) {
    styles.remove();
  }
  
  // Actualizar localStorage
  localStorage.setItem('konecta-theme', 'light');
}

// Verificar si estamos en modo Prueba1 (agregando un parámetro a la URL)
function checkForPrueba1Mode() {
  // Verificar si la URL contiene el parámetro "mode=prueba1"
  const params = new URLSearchParams(window.location.search);
  const isPrueba1 = params.get('mode') === 'prueba1';
  
  if (isPrueba1) {
    applyDarkTheme();
  } else {
    // Si estaba en modo prueba1 antes pero ya no, restaurar tema claro
    if (document.getElementById('prueba1-badge')) {
      restoreLightTheme();
    }
  }
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', checkForPrueba1Mode);

// También verificar cuando cambie la URL (para aplicaciones SPA)
window.addEventListener('popstate', checkForPrueba1Mode);

// Exponer funciones globalmente para uso desde la consola o botones
window.enablePrueba1 = applyDarkTheme;
window.disablePrueba1 = restoreLightTheme;