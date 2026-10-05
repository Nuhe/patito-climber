# Patito Cumbre

Juego original de escalada inspirado en los arcades clásicos, con estética de 8 bits, búhos de plataforma y aves rapaces que cruzan la montaña. Se aloja como sitio estático en GitHub Pages. El ranking global usa Supabase.

## Jugar localmente

Desde esta carpeta:

```bash
python3 -m http.server 8000
```

Abrí `http://localhost:8000`. El navegador necesita un servidor local porque `game.js` usa módulos JavaScript.

**Controles:** flechas izquierda/derecha o A/D para moverse; espacio, flecha arriba o W para saltar; X o J para el aletazo animado. En pantallas táctiles aparecen botones. Al llegar a la cima o perder todas las vidas, se puede guardar una marca con 1 a 3 letras.

## Activar el ranking global

1. En el proyecto Supabase indicado en `config.js`, abrí **SQL Editor**.
2. Ejecutá el contenido de [`supabase.sql`](./supabase.sql).
3. Recargá el juego. El ranking debería mostrar las mejores 10 marcas.

La clave `sb_publishable_…` de `config.js` es pública y apta para el navegador. **Nunca pongas una clave `service_role` o `sb_secret_…` en el repositorio.**

El ranking es casual: los datos se validan en la tabla, pero un cliente modificado puede enviar puntuaciones inventadas. Para un ranking competitivo haría falta validar las partidas en un servidor.

## Publicar en GitHub Pages

1. El código ya está en [Nuhe/patito-climber](https://github.com/Nuhe/patito-climber). Para subir futuras modificaciones desde esta carpeta:

   ```bash
   git push origin main
   ```

2. En el repositorio, abrí **Settings → Pages**. En **Build and deployment**, elegí **Deploy from a branch**, rama `main`, carpeta `/(root)` y guardá.
3. La URL publicada será `https://nuhe.github.io/patito-climber/`.

No hace falta compilar ni instalar dependencias. Los archivos usan rutas relativas para funcionar bajo el prefijo del repositorio.
