# Efficommerce — Generador de Etiquetas

App web para generar e imprimir etiquetas de bodega.  
**Frontend**: HTML/CSS/JS estático  
**Backend**: Vercel Serverless Functions  
**Base de datos**: Supabase PostgreSQL

---

## 🚀 Setup paso a paso

### 1. Supabase

1. Ir a [supabase.com](https://supabase.com) → New Project
2. Copiar la URL y las keys desde **Project Settings → API**
3. Ir a **SQL Editor** y ejecutar el contenido de `supabase-schema.sql`
4. Crear el usuario coordinador:
   - Ir a **Authentication → Users → Invite User**
   - Ingresar el email del coordinador (ej: `coordinador@efficommerce.com`)
   - El coordinador recibirá un email para establecer su contraseña

### 2. Variables de entorno

Copiar `.env.example` a `.env` y completar:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...       (Project Settings → API → anon public)
SUPABASE_SERVICE_KEY=eyJxxx...    (Project Settings → API → service_role secret)
```

### 3. Vercel

1. Subir el proyecto a GitHub
2. Ir a [vercel.com](https://vercel.com) → New Project → importar repo
3. En **Environment Variables** agregar las 3 variables del `.env`
4. Deploy → listo

### 4. Migrar inventario existente

Si tenés datos en el `etiquetas.html` anterior (localStorage), podés importarlos:

1. En la app vieja: Modo Coordinador → Configuración → **Exportar JSON**
2. En la app nueva: Modo Coordinador → Configuración → **Importar JSON**

---

## 📁 Estructura

```
efficommerce-etiquetas/
├── api/
│   ├── _supabase.js      # Cliente Supabase
│   ├── auth.js           # Login coordinador
│   ├── tiendas.js        # CRUD tiendas
│   ├── productos.js      # CRUD productos
│   └── config.js         # Logos y configuración
├── public/
│   └── index.html        # App completa
├── supabase-schema.sql   # Schema de la BD
├── vercel.json           # Configuración Vercel
├── package.json
└── .env.example
```

---

## 🔐 Acceso

- **Usuarios normales**: acceden directo, sin login. Pueden ver inventario e imprimir etiquetas.
- **Coordinador**: hace login con email + contraseña para editar tiendas, productos y ubicaciones.

---

## 📦 Desarrollo local

```bash
npm install -g vercel
vercel dev
```

Abre `http://localhost:3000`
