import React from 'react';
import { createRoot } from "react-dom/client";
import "./index.css";

// Componente de emergencia extremadamente simple
function EmergencyApp() {
  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '40px auto',
      padding: '20px',
      boxShadow: '0 0 10px rgba(0,0,0,0.1)',
      borderRadius: '8px',
      backgroundColor: 'white'
    }}>
      <header style={{
        borderBottom: '1px solid #eee',
        paddingBottom: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            backgroundColor: '#0059A9',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '24px'
          }}>
            K
          </div>
          <h1 style={{ 
            margin: 0,
            color: '#0059A9',
            fontSize: '24px'
          }}>
            Sistema de Gestión de Pedidos
          </h1>
        </div>
      </header>
      
      <div style={{
        padding: '15px',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeeba',
        borderRadius: '4px',
        marginBottom: '20px',
        color: '#856404'
      }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Modo de Recuperación</h2>
        <p>El sistema está experimentando dificultades técnicas. Estamos trabajando para restablecer todas las funcionalidades.</p>
      </div>
      
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '18px' }}>Opciones disponibles:</h3>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '10px' }}>
            <a href="/recovery" style={{
              color: '#0056b3',
              textDecoration: 'underline'
            }}>Ir a la página de recuperación</a>
          </li>
          <li style={{ marginBottom: '10px' }}>
            <a href="/static-app" style={{
              color: '#0056b3',
              textDecoration: 'underline',
              fontWeight: 'bold'
            }}>Usar la versión estática del sistema</a> (recomendado)
          </li>
        </ul>
      </div>
      
      <a href="/static-app" style={{
        display: 'inline-block',
        padding: '10px 16px',
        backgroundColor: '#0059A9',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '4px',
        fontWeight: 'bold'
      }}>
        Acceder a la versión estática
      </a>
      
      <div style={{
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid #eee',
        fontSize: '0.9em',
        color: '#6c757d',
        textAlign: 'center'
      }}>
        <p>© Konecta 2025 - Fecha y hora: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}

// Renderizar directamente sin ningún provider o componente adicional
try {
  const rootElement = document.getElementById("root");
  
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<EmergencyApp />);
    console.log('Componente de emergencia renderizado correctamente');
  } else {
    console.error('No se encontró el elemento root');
    document.body.innerHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-radius: 8px; background-color: white;">
        <h1 style="color: #0059A9;">Sistema de Gestión de Pedidos</h1>
        <p style="color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 4px;">El sistema está experimentando dificultades técnicas.</p>
        <p><a href="/static-app" style="color: #0056b3;">Ir a la versión estática</a></p>
      </div>
    `;
  }
} catch (error) {
  console.error('Error al renderizar componente de emergencia:', error);
  
  // Método de último recurso: mostrar algo en el DOM
  document.body.innerHTML = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-radius: 8px; background-color: white;">
      <h1 style="color: #0059A9;">Sistema de Gestión de Pedidos</h1>
      <p style="color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 4px;">El sistema está experimentando dificultades técnicas.</p>
      <p><a href="/static-app" style="color: #0056b3;">Ir a la versión estática</a></p>
    </div>
  `;
}