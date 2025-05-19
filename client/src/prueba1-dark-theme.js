// Este script aplicará automáticamente un tema oscuro a toda la aplicación
// para la versión "Prueba1" en el puerto 5001

// Verificar si estamos en la versión "Prueba1" (puerto 5001)
if (window.location.port === '5001') {
  console.log('🌙 Aplicando tema oscuro para versión PRUEBA1');
  
  // Función para aplicar el tema oscuro
  function applyDarkTheme() {
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
    `;
    
    // Solo agregar los estilos si no existen ya
    if (!document.getElementById('prueba1-styles')) {
      document.head.appendChild(styleEl);
    }
  }
  
  // Aplicar tema oscuro inmediatamente
  applyDarkTheme();
  
  // También aplicar después de cualquier posible carga de la aplicación
  window.addEventListener('load', applyDarkTheme);
  
  // Volver a aplicar periódicamente para asegurar que se mantiene
  setInterval(applyDarkTheme, 2000);
}