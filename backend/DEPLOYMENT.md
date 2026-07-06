# Panduan Deployment VPS Ubuntu

## Prerequisites
- VPS Ubuntu 20.04 atau lebih baru
- Nginx terinstall
- Python 3.9+ terinstall
- Domain yang menunjuk ke IP VPS (optional tapi disarankan)

---

## Step 1: Generate JWT_SECRET Baru

Di VPS Anda, jalankan:
```bash
cd /path/to/your/backend

# Generate JWT secret
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Copy hasilnya.

---

## Step 2: Buat File .env di VPS

```bash
cd /path/to/your/backend
nano .env
```

Isi dengan:
```env
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=<hasil-dari-step-1>
ALLOWED_ORIGINS=https://your-domain.com,http://YOUR_VPS_IP:3000
```

---

## Step 3: Install Dependencies

```bash
cd /path/to/your/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## Step 4: Setup Systemd Service

Buat service file:
```bash
sudo nano /etc/systemd/system/budget-api.service
```

Isi dengan:
```ini
[Unit]
Description=Budget API Service
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/your/backend
Environment="PATH=/path/to/your/backend/venv/bin"
Environment="PYTHONPATH=/path/to/your/backend"
ExecStart=/path/to/your/backend/venv/bin/uvicorn src.server:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Aktifkan service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable budget-api
sudo systemctl start budget-api
sudo systemctl status budget-api
```

---

## Step 5: Setup Nginx dengan SSL

Install SSL certificate:
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Konfigurasi Nginx:
```bash
sudo nano /etc/nginx/sites-available/budget-api
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 100M;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Aktifkan site:
```bash
sudo ln -s /etc/nginx/sites-available/budget-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 6: Setup Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## Step 7: Auto-Renew SSL

Certbot renew secara otomatis, tapi kita perlu test:
```bash
sudo certbot renew --dry-run
```

---

## Troubleshooting

### Check API logs:
```bash
sudo journalctl -u budget-api -f
```

### Restart API:
```bash
sudo systemctl restart budget-api
```

### Check Nginx logs:
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Test API:
```bash
curl http://127.0.0.1:8000/health
```

---

## Update Aplikasi

Ketika ada update code:

```bash
cd /path/to/your/backend
git pull

# Activate venv
source venv/bin/activate
pip install -r requirements.txt

# Restart service
sudo systemctl restart budget-api
```
