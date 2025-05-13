import React from 'react';
import { createRoot } from "react-dom/client";
import "./index.css";

// Componente extremadamente básico que no depende de nada más
function EmergencyComponent() {
  return (
    <div style={{
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto',
      marginTop: '50px'
    }}>
      <h1 style={{ color: '#111', marginBottom: '20px' }}>Sistema de Gestión de Pedidos - Konecta</h1>
      
      <div style={{ 
        padding: '15px',
        border: '1px solid #f0ad4e',
        backgroundColor: '#fcf8e3',
        borderRadius: '5px',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#8a6d3b', marginTop: 0 }}>Página de Recuperación de Emergencia</h2>
        <p>El sistema está experimentando dificultades técnicas. Estamos trabajando para resolverlo lo antes posible.</p>
      </div>
      
      <div style={{ marginTop: '30px' }}>
        <p><strong>Opciones disponibles:</strong></p>
        <ul style={{ listStyleType: 'disc', marginLeft: '20px' }}>
          <li>Espere unos momentos y recargue la página</li>
          <li>Si el problema persiste, contacte al administrador del sistema</li>
        </ul>
      </div>
      
      <div style={{ marginTop: '40px', fontSize: '0.9em', color: '#777' }}>
        <p>Fecha y hora: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}

// Renderizar directamente sin envoltorios adicionales
try {
  const rootElement = document.getElementById("root");
  
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<EmergencyComponent />);
    console.log('Componente de emergencia renderizado correctamente');
  } else {
    console.error('No se encontró el elemento root');
    
    // Crear un nuevo elemento raíz como fallback
    const newRoot = document.createElement('div');
    newRoot.id = 'emergency-root';
    document.body.appendChild(newRoot);
    
    const emergencyRoot = createRoot(newRoot);
    emergencyRoot.render(<EmergencyComponent />);
    console.log('Componente de emergencia renderizado en nuevo elemento raíz');
  }
} catch (error) {
  console.error('Error al renderizar el componente de emergencia:', error);
  
  // Método de último recurso: mostrar algo en el DOM
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial; max-width: 600px; margin: 50px auto; 
                border: 1px solid #f0ad4e; background-color: #fcf8e3; border-radius: 5px;">
      <h1 style="color: #8a6d3b;">Sistema de Gestión de Pedidos - Konecta</h1>
      <p>El sistema está experimentando dificultades técnicas.</p>
      <p>Por favor, recargue la página o contacte al administrador.</p>
    </div>
  `;
}