# Network Automation Dashboard

Full-stack network automation dashboard with JWT auth, Socket.io realtime updates, MongoDB history, and Python-backed config analysis.

## Local Development

1. Install dependencies with `npm install`.
2. Start both apps with `npm run dev`.
3. Open the frontend at `http://localhost:5173`.

The Vite dev server proxies `/api` to the backend on `http://localhost:3000`, so no frontend API URL is needed for local development.

## Deployment Setup

Use Render for the backend and frontend, and MongoDB Atlas for persistence.

Backend service env vars:

- `PORT=10000`
- `NODE_ENV=production`
- `MONGODB_URI=<your MongoDB Atlas connection string>`
- `JWT_SECRET=<strong production secret>`
- `PYTHON_PATH=python3`
- `FRONTEND_URL=<your deployed frontend URL>`

Frontend static site env vars:

- `VITE_BACKEND_URL=<your deployed backend URL>`
- `VITE_SOCKET_URL=<your deployed backend URL>`

Build command: `npm install && npm run build`

Publish directory: `dist`

## Features

- JWT registration and login
- Protected dashboard routes
- Realtime device and metric updates
- MongoDB-backed config history with local fallback
- Python validation for duplicate IPs, gateway issues, VLANs, BGP, ACLs, and routing consistency

## Sample Config

Use `sample-configs/bgp-router.txt` to test the analyzer and validation panels.
