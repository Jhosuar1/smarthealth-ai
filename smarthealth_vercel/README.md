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

## Desplegar en Vercel + Neon

1. Crear BD gratuita en [neon.tech](https://neon.tech)
2. Copiar `DATABASE_URL` de Neon
3. En Vercel → Environment Variables agregar:
   - `DATABASE_URL` = tu URL de Neon
   - `JWT_SECRET` = cadena aleatoria larga
   - `ANTHROPIC_API_KEY` = tu key (opcional)
4. Conectar repo de GitHub y desplegar

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
