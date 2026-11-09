# Deployment guide

## Emergent (recommended)
Use the **Deploy** button. Backend runs on port 8001 behind `/api`, frontend on 3000. Set production secrets (`JWT_SECRET`, seed passwords, `CORS_ORIGINS`) in the deployment secrets panel. Migrations run automatically at startup.

## Self-hosting (single VM, low cost)
1. Install MongoDB 7, Python 3.11, Node 20.
2. `backend/.env` from `.env.example`: strong `JWT_SECRET` (≥48 random chars), `CORS_ORIGINS=https://your-domain`, `SEED_TENANT_B=false`, change seed passwords.
3. Backend: `pip install -r requirements.txt && uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2` (systemd unit).
4. Frontend: `REACT_APP_BACKEND_URL=https://your-domain yarn build` → serve `frontend/dist` via nginx.
5. nginx: `location /api { proxy_pass http://127.0.0.1:8001; }`, everything else → `dist/index.html` (SPA fallback). Enable HTTPS (certbot).
6. Rate limits are per process; with multiple workers/instances move them to Redis (see D-011).
7. Schedule `scripts/backup.sh` daily (see BACKUP_RESTORE.md).

## Post-deploy checklist
- Sign in as the architect, change passwords (Users & Settings), verify GST rate and branding.
- Verify the imported template (Overview → Source import flags), publish v1.
- Create a test estimate, issue it, download PDF/XLSX/CSV, open a share link in a private window.
