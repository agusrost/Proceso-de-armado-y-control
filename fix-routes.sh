#!/bin/bash

# Este script corrige el error de sintaxis en server/routes.ts
# reemplazando la sección problemática

# Eliminar las líneas problemáticas
sed -i '2953,2960d' server/routes.ts

# Insertar el código corregido
sed -i '2952a\
      // Ordenar por fecha ascendente (más antigua primero - FIFO)\
      const solicitudesFinales = solicitudesProcesadas.sort((a, b) => {\
        if (!a || !b || !a.fecha || !b.fecha) return 0;\
        return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();\
      });\
      \
      console.log(`Se encontraron ${solicitudesFinales.length} solicitudes de stock pendientes (sin duplicados)`);\
      res.json(solicitudesFinales);' server/routes.ts