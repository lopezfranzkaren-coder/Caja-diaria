# 🚀 Caja Diaria — Instrucciones de Deploy
## GitHub + Supabase + Render (100% gratuito)

---

## PASO 1 — Crear proyecto en Supabase

1. Entrá a https://supabase.com y creá un nuevo proyecto
2. Elegí un nombre (ej: `caja-diaria`) y una contraseña para la DB
3. Una vez creado, andá a **SQL Editor**
4. Pegá todo el contenido del archivo `supabase_schema.sql` y ejecutalo
5. Guardá estas dos claves (las vas a necesitar en el paso 3):
   - **Project URL** → Settings > API > Project URL
   - **anon public key** → Settings > API > Project API keys

---

## PASO 2 — Subir el código a GitHub

1. Creá un repositorio nuevo en https://github.com (puede ser privado)
2. Desde tu computadora, en la carpeta `caja-app`:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

---

## PASO 3 — Deploy en Render

1. Entrá a https://render.com y creá una cuenta (gratis)
2. Click en **New +** → **Static Site**
3. Conectá tu repositorio de GitHub
4. Configurá así:
   - **Name:** caja-diaria
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
5. En **Environment Variables** agregá:
   - `VITE_SUPABASE_URL` → tu Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` → tu anon key de Supabase
6. Click **Create Static Site**

Render va a buildear y darte una URL tipo:
`https://caja-diaria.onrender.com`

---

## PASO 4 — Listo 🎉

La app queda online, accesible desde cualquier dispositivo.
Cada vez que hagas `git push`, Render redespliega automáticamente.

---

## Actualizar la app en el futuro

```bash
# Editar archivos → luego:
git add .
git commit -m "descripción del cambio"
git push
```
Render detecta el push y redespliega solo.

---

## Notas importantes

- Los datos viven en Supabase (no en el browser), así que son accesibles
  desde cualquier dispositivo que use la URL
- Supabase free tier: 500MB de base de datos, más que suficiente
- Render free tier: puede tardar ~30 segundos en cargar si estuvo inactiva
  (se "duerme" después de 15 min sin uso en el plan gratuito)
  → Solución: usá el plan de Static Site (no se duerme, es completamente gratis)
