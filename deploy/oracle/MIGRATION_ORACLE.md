# Migración de RIAL a Oracle Cloud (arquitectura híbrida)

Backend + Postgres → **VM Ampere A1 (ARM) de Oracle, siempre encendida** (mata el cold-start de Render).
Frontend → **se queda en Vercel** (edge cerca de Miami). Dominio: `rialstateai.com`.

```
  Usuario (Miami)
        │  https://rialstateai.com           https://api.rialstateai.com
        ▼                                              ▼
   ┌──────────┐   rewrites /api/* (proxy)      ┌──────────────────────────────┐
   │  Vercel  │ ─────────────────────────────► │  VM Oracle A1 (Ashburn)       │
   │ (front)  │                                │  Caddy → API (Express) → DB   │
   └──────────┘                                │  (Postgres en Docker)         │
                                               └──────────────────────────────┘
```

Todo lo de Docker/Caddy/Postgres ya está versionado en `deploy/oracle/`. Vos hacés la parte de la
consola de Oracle y el DNS; el resto es correr un script.

---

## 0. Antes de empezar — datos que vas a necesitar a mano
- El **DATABASE_URL de producción actual** (el de Render): Render Dashboard → tu servicio → *Environment*. Lo usás solo si querés conservar los datos actuales (paso 8).
- Las claves que ya tenías en Render: `JWT_SECRET`, SMTP, Stripe, VAPID, RentCast, Google OAuth. Las vas a re-pegar en `.env.production`.
- Acceso al panel del **registrador del dominio** `rialstateai.com` (para los DNS).
- Acceso al **dashboard de Vercel** (para el cutover final).

---

## 1. Crear la cuenta Oracle Cloud — ⚠️ el paso irreversible
1. Andá a **oracle.com/cloud/free** y registrate (pide tarjeta solo para verificar; en "Always Free" no se cobra).
2. **Home Region = `US East (Ashburn)`**. 🚨 Esto **NO se puede cambiar nunca** y es donde viven todos los recursos gratis. Ashburn es la región más cercana a Miami (~25–40 ms) y la de mejor disponibilidad ARM. **No elijas otra.**
3. (Recomendado) Tras entrar: menú → *Billing* → *Budgets* → creá un budget en **USD 0–1** con alerta por email, para enterarte si algo se sale del free tier.

---

## 2. Crear la VM Ampere A1 (ARM)
Console → **Compute → Instances → Create instance**:
- **Name:** `rial-prod`
- **Image:** *Canonical Ubuntu 24.04* — ⚠️ elegí la variante **aarch64 (Arm)**.
- **Shape:** *Ampere* → **VM.Standard.A1.Flex** → **2 OCPUs / 12 GB RAM** (el máximo Always Free desde jun-2026; no pongas más o queda fuera del free tier).
- **Boot volume:** subilo a **100–200 GB** (gratis hasta 200 GB en total).
- **SSH keys:** *Generate a key pair* y **descargá la private key** (la vas a usar para entrar). Guardala bien.
- Create.

> **Si aparece "Out of host capacity"** (clásico del A1): probá cambiar el *Availability Domain* (AD-1/2/3) en el form, o reintentá más tarde. Ashburn suele tener stock; si insiste, un scriptcito que reintenta cada X min lo resuelve — avisame y te lo armo.

Cuando esté *Running*, anotá la **IP pública**.

### 2.1 Reservar la IP (para que no cambie)
Networking → la VNIC de la instancia → la IP pública → cambiá de *Ephemeral* a **Reserved**. Así el DNS no se rompe si reiniciás.

---

## 3. Abrir los puertos — en LOS DOS lugares (gotcha clásico de Oracle)
La VM tiene **dos** firewalls. Si abrís solo uno, Caddy no puede emitir el certificado y nada responde.

**(a) Security List del VCN** (firewall del cloud):
Networking → Virtual Cloud Networks → tu VCN → Subnet → *Security List* → **Add Ingress Rules**:
- Source `0.0.0.0/0`, TCP, **dest port 80**
- Source `0.0.0.0/0`, TCP, **dest port 443**
- (el 22/SSH ya viene abierto por defecto)

**(b) iptables del Ubuntu** (firewall del SO — Oracle lo trae cerrado por defecto):
Entrá por SSH (paso 4) y corré:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## 4. Entrar a la VM e instalar Docker
Desde tu PC (PowerShell o Git Bash), con la private key descargada:
```bash
ssh -i /ruta/a/tu-key.key ubuntu@LA_IP_PUBLICA
```
Ya dentro de la VM:
```bash
# Docker + plugin compose (oficial)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker          # aplica el grupo sin reloguear
docker --version && docker compose version
```

---

## 5. Clonar el repo en la VM
```bash
sudo apt-get update && sudo apt-get install -y git
git clone <URL_DE_TU_REPO_RIAL> rial
cd rial/deploy/oracle
```
> Si el repo es privado, usá un *deploy key* de GitHub o `gh auth login`. Avisame y te guío.

---

## 6. Configurar las variables de producción
```bash
cp .env.production.example .env.production
nano .env.production
```
Completá **todo** (ver el archivo de ejemplo). Imprescindibles:
- `POSTGRES_PASSWORD` (uno fuerte) y que coincida dentro de `DATABASE_URL`/`DIRECT_URL`.
- `JWT_SECRET` → generalo con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (o `openssl rand -hex 48`).
- `CORS_ORIGINS=https://rialstateai.com,https://www.rialstateai.com`
- SMTP, Stripe, VAPID (¡el **mismo** par que en Render!), RentCast, Google OAuth.

---

## 7. Apuntar el DNS
En el registrador de `rialstateai.com`:

| Tipo  | Nombre | Valor                          | Para qué |
|-------|--------|--------------------------------|----------|
| A     | `api`  | **IP pública de la VM Oracle** | backend  |
| A/ALIAS/CNAME | `@` (raíz) y `www` | lo que indique **Vercel** (Vercel → tu proyecto → *Settings → Domains*, agregá `rialstateai.com`) | frontend |

Esperá a que `api.rialstateai.com` resuelva a la IP (`nslookup api.rialstateai.com`) **antes** de deployar, así Caddy puede sacar el certificado.

---

## 8. (Opcional) Migrar los datos actuales de Render
Si querés conservar usuarios/propiedades/reservas. Si arrancás de cero, **saltá al paso 9** (las migraciones crean el esquema vacío solo).

Desde la VM (tiene Postgres client vía Docker):
```bash
cd ~/rial/deploy/oracle
# 1) Levantá SOLO la base primero
docker compose --env-file .env.production up -d db

# 2) Dump del Postgres actual de Render (poné tu DATABASE_URL de Render entre comillas)
docker run --rm postgres:16 pg_dump --no-owner --no-acl \
  "postgresql://USER:PASS@HOST:5432/DB" > rial_dump.sql

# 3) Restaurá dentro del contenedor db
docker compose exec -T db psql -U rial -d rial < rial_dump.sql
```
Como el dump trae también la tabla `_prisma_migrations`, el backend va a ver la base "al día" y no re-aplica nada.

---

## 9. Deploy 🚀
```bash
cd ~/rial/deploy/oracle
chmod +x deploy.sh
./deploy.sh
```
Esto buildea la imagen ARM del backend, levanta Postgres + API + Caddy, y corre `prisma migrate deploy` solo.

**Verificá:**
```bash
curl -fsS https://api.rialstateai.com/health      # debe responder OK
docker compose logs -f api                         # logs del backend
```
La primera vez Caddy tarda ~10–30 s en emitir el certificado TLS.

---

## 10. Actualizar las integraciones externas a la URL nueva
- **Stripe** → Dashboard → *Webhooks*: el endpoint ahora es
  `https://api.rialstateai.com/api/payments/stripe/webhook` (evento `checkout.session.completed`).
- **Google Cloud Console** → *Credentials* → tu OAuth client → *Authorized redirect URIs*:
  agregá `https://api.rialstateai.com/api/calendar/auth/google/callback` (debe coincidir EXACTO con `GOOGLE_REDIRECT_URI`).

---

## 11. Cutover del frontend (cuando el backend nuevo ya responda OK)
El front pega a `/api/*` relativo y Vercel lo proxya al backend vía *rewrites*, que se generan desde una env var. Cambiás esa variable y redeployás:

1. Vercel → tu proyecto → **Settings → Environment Variables**: editá **`RENDER_API_URL`** (o `VITE_API_URL` si usabas esa) de
   `https://rial-zwv8.onrender.com`  →  **`https://api.rialstateai.com`**
2. **Redeploy** del front en Vercel.
3. Probá el sitio en `https://rialstateai.com`: login, listado de propiedades, una reserva de prueba.

> El primer load ya no va a tener el "tarda en cargar" del cold-start: la VM está siempre encendida.

---

## 12. Apagar lo viejo
Una vez que todo anda en `rialstateai.com`:
- Render: suspendé/borrá el servicio del backend (y su Postgres si tenías uno aparte).
- El **keep-alive worker** de Cloudflare ya no hace falta (era para despertar Render). Podés borrar el cron del Worker.

---

## 13. Rollback (si algo sale mal en el cutover)
Volvé `RENDER_API_URL` en Vercel a `https://rial-zwv8.onrender.com` y redeploy. Mientras no apagues Render (paso 12), el rollback es instantáneo.

---

## 14. Operación día a día
```bash
cd ~/rial/deploy/oracle
docker compose ps                 # estado
docker compose logs -f api        # logs en vivo
./deploy.sh                       # actualizar tras un git push (rebuild + migraciones)

# Backup de la base con rotación (ya viene listo el script):
./backup.sh
# Automatizarlo diario 03:00:  crontab -e
#   0 3 * * *  /home/ubuntu/rial/deploy/oracle/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
```
> Tip: el `backup.sh` guarda dumps comprimidos con rotación de 14 días en `~/backups`. Próximo nivel (opcional): subirlos a **Object Storage** (10 GB gratis) para backups off-box durables.

---

### Resumen de lo que ya quedó listo en el repo
| Archivo | Qué hace |
|---|---|
| `real-rentals-ai/Dockerfile` + `docker-entrypoint.sh` | Imagen ARM del backend; corre migraciones al arrancar |
| `real-rentals-ai/prisma/schema.prisma` | Agregado `binaryTargets` arm64 (Prisma en ARM) |
| `real-rentals-ai/src/index.ts` | `trust proxy` para correr detrás de Caddy |
| `deploy/oracle/docker-compose.yml` | Postgres + API + Caddy |
| `deploy/oracle/Caddyfile` | HTTPS automático para `api.rialstateai.com` |
| `deploy/oracle/.env.production.example` | Plantilla de variables |
| `deploy/oracle/deploy.sh` | Build + up + migraciones, en un comando |
