# Laboratorio de balanceo

Simulador local de cuatro servidores. Necesitas Git y Node.js 22.12 o posterior.

## Puesta en marcha

1. Haz un fork del repositorio y clona tu fork.
2. Desde la carpeta del proyecto, ejecuta `npm install` y luego `npm run dev`.
3. Abre la dirección que muestra Vite. Selecciona un escenario y pulsa **Ejecutar**.

## Actividad

Edita `LoadBalancer.js`. El simulador llama a `onRequestArrival` una vez por petición. El ejemplo empieza enviando todas las peticiones al primer servidor. Guarda el archivo, vuelve a ejecutar el escenario y haz un commit al terminar cada ronda. Al final, sube tu rama y comparte el enlace a tu fork.
