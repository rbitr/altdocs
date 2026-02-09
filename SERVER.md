# Deploying AltDocs on a VPS

Step-by-step guide to hosting AltDocs on a Linux VPS with HTTPS.

## Minimum VPS Specs

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU      | 1 vCPU  | 2 vCPU      |
| RAM      | 512 MB  | 1 GB        |
| Disk     | 10 GB SSD | 20 GB SSD |
| OS       | Ubuntu 22.04 or 24.04 LTS | Ubuntu 24.04 LTS |

SQLite and Node.js are lightweight. 512 MB is enough for low traffic (a handful of concurrent users). Bump to 1 GB if you expect dozens of simultaneous editors or large documents with images.

---

## 1. Point Your Domain to the Server

Before starting, create a DNS A record pointing your domain to the server's IP address. This is required for HTTPS certificate provisioning later.

```
Type: A
Name: @ (or subdomain like "docs")
Value: <your-server-ip>
TTL: 300
```

DNS propagation can take minutes to hours, so do this first.

---

## 2. Initial Server Setup

SSH into your server:

```bash
ssh root@<your-server-ip>
```

Update packages and install essentials:

```bash
apt update && apt upgrade -y
apt install -y build-essential git curl ufw
```

`build-essential` provides the C/C++ toolchain required by `better-sqlite3`.

### Create a non-root user (if you don't have one)

```bash
adduser deploy
usermod -aG sudo deploy
```

Switch to that user for the remaining steps:

```bash
su - deploy
```

### Configure the firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## 3. Install Node.js

Install Node.js 20 LTS via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
node -v   # should be v20.x
npm -v    # should be v9+
```

---

## 4. Install nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Verify it's running by visiting `http://<your-server-ip>` in a browser — you should see the nginx welcome page.

---

## 5. Get the Application Code

Clone the repository (or upload it via scp/rsync):

```bash
cd /home/deploy
git clone <your-repo-url> altdocs
cd altdocs
```

Or if copying from your local machine:

```bash
# From your local machine:
rsync -avz --exclude node_modules --exclude data --exclude dist \
  ./ deploy@<your-server-ip>:/home/deploy/altdocs/
```

### Install dependencies and build

```bash
cd /home/deploy/altdocs
npm install
npm run build
```

The build outputs static client files to `dist/client/`. The server will serve these.

### Verify it works

```bash
PORT=3000 npm run dev
# In another terminal or with curl:
curl http://localhost:3000/api/documents
# Should return [] (empty array)
```

Press Ctrl+C to stop.

---

## 6. Create a systemd Service

This keeps AltDocs running in the background and restarts it on crash or reboot.

```bash
sudo tee /etc/systemd/system/altdocs.service > /dev/null <<'EOF'
[Unit]
Description=AltDocs Document Editor
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/altdocs
ExecStart=/usr/bin/node --import tsx src/server/index.ts
Restart=on-failure
RestartSec=5
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
```

> **Note:** This runs the server using `tsx` (TypeScript execution) as the project does in development. If you prefer, you can compile to JavaScript first and run the compiled output instead. The above matches `npm run dev` behavior.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable altdocs
sudo systemctl start altdocs
```

Check it's running:

```bash
sudo systemctl status altdocs
curl http://localhost:3000/api/documents
```

View logs:

```bash
sudo journalctl -u altdocs -f
```

---

## 7. Configure nginx as a Reverse Proxy

Replace `yourdomain.com` with your actual domain in the config below.

```bash
sudo tee /etc/nginx/sites-available/altdocs > /dev/null <<'NGINX'
server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (required for real-time collaboration)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeout settings for WebSocket connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
NGINX
```

Enable the site and restart nginx:

```bash
sudo ln -s /etc/nginx/sites-available/altdocs /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Verify: visit `http://yourdomain.com` — you should see AltDocs.

---

## 8. Set Up HTTPS with Let's Encrypt

Install certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Obtain and install the certificate:

```bash
sudo certbot --nginx -d yourdomain.com
```

Certbot will:
- Verify you own the domain (via HTTP challenge — DNS must be pointing to this server)
- Obtain a free TLS certificate
- Automatically modify your nginx config to redirect HTTP → HTTPS
- Set up auto-renewal via a systemd timer

Verify auto-renewal is active:

```bash
sudo systemctl list-timers | grep certbot
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

Your site is now live at `https://yourdomain.com`.

---

## 9. Verify Everything Works

1. Open `https://yourdomain.com` in a browser
2. You should be assigned an anonymous session automatically
3. Create a document and edit it
4. Open a second browser / incognito window — you should get a separate anonymous user and see only your own documents
5. Test sharing: create a share link from the first user, open it in the second browser

---

## Ongoing Maintenance

### Updating the application

```bash
cd /home/deploy/altdocs
git pull
npm install
npm run build
sudo systemctl restart altdocs
```

### Backups

The database is a single file. Back it up regularly:

```bash
# Safe backup while the server is running (SQLite WAL mode)
sqlite3 /home/deploy/altdocs/data/altdocs.db ".backup /home/deploy/backups/altdocs-$(date +%Y%m%d).db"
```

Uploaded files live in `/home/deploy/altdocs/uploads/` — back these up too.

### Monitoring

```bash
# Service status
sudo systemctl status altdocs

# Live logs
sudo journalctl -u altdocs -f

# Disk usage
du -sh /home/deploy/altdocs/data/
du -sh /home/deploy/altdocs/uploads/
```
