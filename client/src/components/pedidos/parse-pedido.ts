import { ParsedPedido, ParsedProduct } from "@shared/types";

export function parsePedidoText(text: string): ParsedPedido {
  const lines = text.trim().split("\n").filter(line => line.trim().length > 0);
  
  // We need at least a few lines to have a valid pedido
  if (lines.length < 3) {
    throw new Error("El texto no contiene suficiente información");
  }
  
  // Find client ID and pedido ID within the first few lines
  let clienteId = "";
  let pedidoId = "";
  
  // Buscar datos en las primeras líneas (típicamente Código del cliente y número de pedido)
  const firstLineData = lines[0].match(/(?:Codigo|Código|Code):\s*(\d+)/i);
  const secondLineData = lines[0].match(/(?:Pedido|Numero|Número|Order):\s*(\d+)/i) || 
                        lines[1].match(/(?:Pedido|Numero|Número|Order):\s*(\d+)/i);
  
  if (firstLineData) {
    clienteId = firstLineData[1];
  } else {
    // Fallback method - look for any number in the first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const clientMatch = lines[i].match(/(\d{4,})/);
      if (clientMatch) {
        clienteId = clientMatch[1];
        break;
      }
    }
  }
  
  if (secondLineData) {
    pedidoId = secondLineData[1];
  } else {
    // Fallback method - look for any short number in the first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const pedidoMatch = lines[i].match(/\b(\d{1,3})\b/);
      if (pedidoMatch && pedidoMatch[1] !== clienteId) {
        pedidoId = pedidoMatch[1];
        break;
      }
    }
  }
  
  if (!clienteId) {
    throw new Error("No se pudo encontrar el ID del cliente");
  }
  
  if (!pedidoId) {
    pedidoId = "1"; // Default if we can't find a pedido number
  }
  
  // Find vendedor - usually appears after "Vendedor:" or similar text
  let vendedor = "";
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes("vendedor")) {
      vendedor = lines[i].split(/vendedor\s*:/i)[1]?.trim() || "";
      break;
    }
  }
  
  if (!vendedor) {
    // Try alternative approach
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      // Look for name-like patterns
      const nameMatch = lines[i].match(/([A-Za-z]+ [A-Za-z]+)/);
      if (nameMatch && !lines[i].includes("#")) {
        vendedor = nameMatch[1];
        break;
      }
    }
  }
  
  // Find productos
  const productos: ParsedProduct[] = [];
  let startedProducts = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check if this line contains a product code and quantities
    // The format is: CODE#QTY#DESCRIPTION
    const productMatch = line.match(/([A-Za-z0-9]+)#(\d+)#(.+)/);
    
    if (productMatch) {
      startedProducts = true;
      const codigo = productMatch[1];
      const cantidad = parseInt(productMatch[2]);
      const descripcion = productMatch[3].trim();
      
      productos.push({
        codigo,
        cantidad,
        descripcion
      });
    } 
    // If we already started finding products but this line doesn't match the pattern,
    // it might be the end of the product list
    else if (startedProducts) {
      // Check if it's a continuation of the previous product description
      if (!line.includes("#") && productos.length > 0) {
        productos[productos.length - 1].descripcion += " " + line;
      }
    }
  }
  
  if (productos.length === 0) {
    throw new Error("No se pudieron encontrar productos en el texto");
  }
  
  // Calculate totals
  const items = productos.length;
  const totalProductos = productos.reduce((sum, producto) => sum + producto.cantidad, 0);
  const puntaje = items * totalProductos;
  
  return {
    clienteId,
    vendedor,
    pedidoId,
    productos,
    items,
    totalProductos,
    puntaje
  };
}
