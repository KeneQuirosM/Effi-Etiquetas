# Efficommerce — Generador de Etiquetas

App web para generar e imprimir etiquetas de bodega, gestionar almacén físico (STOCKFORGE), manifiestos y devoluciones.

**Frontend**: HTML/CSS/JS estático (sin frameworks)
**Backend**: Vercel Serverless Functions (Node.js ESM)
**Base de datos**: Supabase PostgreSQL

---

## 🚀 Setup paso a paso

### 1. Supabase

1. Ir a [supabase.com](https://supabase.com) → New Project
2. Copiar la URL y las keys desde **Project Settings → API**
3. Ir a **SQL Editor** y ejecutar el contenido de `supabase-schema.sql`
   - Incluye las tablas core (tiendas, productos, configuracion) y las de STOCKFORGE
4. Crear el usuario coordinador:
   - Ir a **Authentication → Users → Invite User**
   - El coordinador recibirá un email para establecer su contraseña

### 2. Variables de entorno

Copiar `.env.example` a `.env` y completar los 4 valores:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
ALLOWED_ORIGIN=https://tu-proyecto.vercel.app   # dejar vacío en desarrollo
```

### 3. Vercel

1. Subir el proyecto a GitHub
2. Ir a [vercel.com](https://vercel.com) → New Project → importar repo
3. En **Environment Variables** agregar las 4 variables
4. Deploy → listo

### 4. Migrar inventario existente

Si tenés datos en un JSON exportado:

1. Modo Coordinador → Configuración → **Importar JSON**

---

## 📁 Estructura

```
effi-etiquetas/
├── api/
│   ├── _supabase.js          # cliente Supabase admin compartido
│   ├── _cors.js              # helper CORS centralizado
│   ├── auth.js               # login con Supabase Auth
│   ├── refresh.js            # renovar token JWT
│   ├── change-password.js    # cambio de contraseña
│   ├── config.js             # logo y configuración general
│   ├── tiendas.js            # CRUD tiendas + inventario
│   ├── productos.js          # CRUD productos
│   ├── stockforge.js         # estado completo del almacén físico
│   └── reporte-tiendas.js    # reporte de movimientos por tienda
├── public/
│   ├── index.html / index.js / index.css     # app de etiquetas
│   ├── almacen4.html / almacen4.js / almacen4.css  # STOCKFORGE
│   ├── manifiesto.html / manifiesto.js / manifiesto.css
│   ├── devoluciones.html / script.js / styles.css
│   └── reporte_distribuidor_proveedor.html
├── .env.example
├── package.json
├── supabase-schema.sql       # schema completo (16 tablas)
└── vercel.json
```

---

## 🔐 Acceso

- **Usuarios normales**: acceden directo, sin login. Pueden ver inventario e imprimir etiquetas.
- **Coordinador**: hace login con email + contraseña para editar tiendas, productos, configuración y STOCKFORGE.

---

## 📦 Desarrollo local

```bash
npm install -g vercel
vercel dev
```

Abre `http://localhost:3000`
