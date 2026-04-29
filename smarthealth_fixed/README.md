# 🏥 SmartHealth AI

Sistema Integral de Gestión de Citas Médicas y Entrega de Medicamentos  
Universidad Tecnológica de Pereira — Ingeniería de Sistemas

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5 · CSS3 · JavaScript vanilla |
| Backend | Node.js · Express.js |
| Base de datos | PostgreSQL |
| Mapa | OpenStreetMap + Leaflet.js |
| IA | Claude (Anthropic) |
| Auth | JWT + bcryptjs |

## Estructura

```
smarthealth/
├── frontend/           ← HTML + CSS + JS (sin frameworks)
│   ├── index.html
│   ├── css/main.css
│   └── js/
│       ├── api.js      ← Cliente HTTP + JWT
│       ├── utils.js    ← Helpers globales
│       ├── map.js      ← Mapa Leaflet
│       ├── pages.js    ← Renderers de páginas
│       └── app.js      ← Controlador principal
├── backend/            ← API REST Node.js
│   ├── server.js
│   ├── config/db.js    ← Conexión PostgreSQL
│   ├── middleware/
│   │   ├── auth.js     ← JWT middleware
│   │   └── audit.js    ← Log de auditoría
│   └── routes/
│       ├── auth.routes.js
│       ├── citas.routes.js
│       ├── formulas.routes.js
│       ├── inventario.routes.js
│       ├── usuarios.routes.js
│       ├── notificaciones.routes.js
│       ├── auditoria.routes.js
│       └── ia.routes.js
├── database/
│   ├── schema.sql      ← Esquema PostgreSQL completo
│   └── fix_estados.sql
├── .env.example        ← Plantilla de variables
└── vercel.json         ← Configuración de despliegue
```

## Correr localmente

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus datos

# 3. Crear base de datos
psql -U postgres -c "CREATE DATABASE smarthealth;"
psql -U postgres -d smarthealth -f database/schema.sql

# 4. Iniciar servidor
npm start
# → http://localhost:3131
```

## Desplegar en Vercel + Supabase

### 1. Crear la base de datos en Supabase

1. Ir a [supabase.com](https://supabase.com) → crear proyecto gratuito
2. En el **SQL Editor** de tu proyecto, copiar y ejecutar el contenido de `database/schema.sql`
3. Ir a **Settings → Database → Connection string**
4. Seleccionar **Transaction pooler** (⚠️ importante: usar puerto **6543**, no 5432)
5. Copiar la URL completa (tiene formato `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres`)

### 2. Desplegar en Vercel

1. Subir el proyecto a GitHub
2. En [vercel.com](https://vercel.com) → New Project → importar tu repo
3. En **Environment Variables** agregar:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | URL del Transaction Pooler de Supabase |
| `JWT_SECRET` | cadena aleatoria larga (mínimo 32 chars) |
| `ANTHROPIC_API_KEY` | tu key de Claude (opcional) |

4. Click en **Deploy** — listo ✅

> **Nota:** El `vercel.json` ya está configurado para servir el frontend como estático y el backend como serverless. No hay que cambiar nada más.


## Usuarios demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Paciente | paciente@demo.com | demo123 |
| Médico | medico@demo.com | demo123 |
| Farmacéutico | farmacia@demo.com | demo123 |
| Admin | admin@demo.com | demo123 |
| Superadmin | super@demo.com | super123 |

## Autores

- Jhosuar Andres Suárez  
- Santiago Suaza  
*Universidad Tecnológica de Pereira*
