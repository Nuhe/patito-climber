# Patito Cumbre

Juego original de escalada inspirado en los arcades clásicos, con estética de 8 bits, búhos de plataforma y aves rapaces que cruzan la montaña. Se aloja como sitio estático en GitHub Pages. El ranking global usa Supabase.

## Jugar localmente

Desde esta carpeta:

```bash
python3 -m http.server 8000
```

Abrí `http://localhost:8000`. El navegador necesita un servidor local porque `game.js` usa módulos JavaScript.

**Controles:** flechas izquierda/derecha o A/D para moverse; espacio, flecha arriba o W para saltar; X o J para el aletazo animado. En pantallas táctiles aparecen botones.

El cronómetro empieza al iniciar la partida. Solo las partidas completadas se guardan, ordenadas de menor a mayor tiempo. Los bloques con grietas se rompen poco después de pisarlos. La cámara solo avanza hacia arriba: una caída termina el intento cuando el patito toca el borde inferior de la pantalla. Tocar un enemigo también termina el intento. Las estrellas son coleccionables, pero no alteran el tiempo.

## Activar el ranking global

1. En el proyecto Supabase indicado en `config.js`, abrí **SQL Editor**.
2. Ejecutá el contenido de [`supabase.sql`](./supabase.sql).
3. Recargá el juego. El ranking debería mostrar las mejores 10 marcas.

**Actualización al ranking de tiempos:** si ya habías ejecutado `supabase.sql`, ejecutá también [`supabase_tiempos.sql`](./supabase_tiempos.sql) en el mismo SQL Editor. Conserva las marcas antiguas en la tabla, pero el nuevo ranking muestra solo tiempos de partidas completadas.

La clave `sb_publishable_…` de `config.js` es pública y apta para el navegador. **Nunca pongas una clave `service_role` o `sb_secret_…` en el repositorio.**

El ranking sigue siendo casual: los datos se validan en la tabla, pero un cliente modificado puede enviar tiempos inventados. Para una competencia con premios haría falta validar las partidas en un servidor.

## Publicar en GitHub Pages

1. El código ya está en [Nuhe/patito-climber](https://github.com/Nuhe/patito-climber). Para subir futuras modificaciones desde esta carpeta:

   ```bash
   git push origin main
   ```

2. En el repositorio, abrí **Settings → Pages**. En **Build and deployment**, elegí **Deploy from a branch**, rama `main`, carpeta `/(root)` y guardá.
3. La URL publicada será `https://nuhe.github.io/patito-climber/`.

No hace falta compilar ni instalar dependencias. Los archivos usan rutas relativas para funcionar bajo el prefijo del repositorio.
