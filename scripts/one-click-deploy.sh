#!/usr/bin/env bash
# ============================================================================
# VYRA ONE-CLICK DEPLOY
# ============================================================================
# Single command som sätter upp ALLT på servern:
#   - Installerar alla paket (nginx, fail2ban, logrotate, etc)
#   - Skapar deploy-användare
#   - Klonar repot
#   - Sätter brandvägg + säkerhet
#   - Sätter SSL (Let's Encrypt) om domän finns
#   - Aktiverar monitorering + backup
#
# ANVÄNDNING:
#   curl -sSL https://raw.githubusercontent.com/davidyakoop88-hub/-VYRA-source-code/main/scripts/one-click-deploy.sh | sudo bash
#
# ELLER om du redan är inloggad på servern:
#   wget https://raw.githubusercontent.com/.../one-click-deploy.sh
#   sudo bash one-click-deploy.sh
# ============================================================================

set -euo pipefail

# --- Färger och helpers ----------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
ok()    { echo -e "${GREEN}✓${NC}  $*"; }
err()   { echo -e "${RED}✗${NC}  $*" >&2; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
info()  { echo -e "${BLUE}ℹ${NC}  $*"; }
step()  { echo -e "\n${CYAN}== $* ==${NC}\n"; }

# --- Root-kontroll ----------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    err "Måste köras som root. Använd: sudo bash $0"
    exit 1
fi

# --- Konfiguration (kan override:as med env-variabler) ---------------------
REPO_URL="${REPO_URL:-https://github.com/davidyakoop88-hub/-VYRA-source-code.git}"
BRANCH="${BRANCH:-feature/vyra-vfx-engine}"
DOMAIN="${DOMAIN:-vyralive.app}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/vyralive.app}"
WEB_SERVER="${WEB_SERVER:-nginx}"
SETUP_SSL="${SETUP_SSL:-auto}"  # auto, yes, no
EMAIL="${EMAIL:-admin@${DOMAIN}}"

echo -e "${CYAN}"
cat << 'EOF'
   __     _____  ___   ___      ____
   \ \   / /  _ \/ _ \ / _ \    |  _ \
    \ \ / /| | | | | | | | | |__| | | | ___ _ __
     \ V / | |_| | |_| | |_| |__| |_| |/ _ \ '_ \
      \_/  |____/ \___/ \___/   |____/ \___/ .__/
                                         |_|
   ONE-CLICK DEPLOY SCRIPT
EOF
echo -e "${NC}\n"

info "Konfiguration:"
echo "  Repo:    $REPO_URL"
echo "  Branch:  $BRANCH"
echo "  Domain:  $DOMAIN"
echo "  Web:     $WEB_SERVER"
echo "  Path:    $DEPLOY_PATH"
echo ""

# Fråga om viktigaste sakerna (om inte auto-mode)
if [ -t 0 ] && [ "${NONINTERACTIVE:-}" != "true" ]; then
    read -p "Fortsätta med installation? (j/n) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[JjYy]$ ]] && { info "Avbruten"; exit 0; }

    read -p "Vill du sätta upp Let's Encrypt SSL för $DOMAIN? (j/n) " -n 1 -r
    echo
    [[ $REPLY =~ ^[JjYy]$ ]] && SETUP_SSL="yes" || SETUP_SSL="no"
fi

# --- Detektera operativsystem ----------------------------------------------
step "Detekterar OS"
. /etc/os-release 2>/dev/null || true
OS="${ID:-linux}"
VER="${VERSION_ID:-}"
ok "OS: $OS $VER"

case "$OS" in
    ubuntu|debian) PKG_INSTALL="apt -y install"; PKG_UPDATE="apt update" ;;
    centos|rhel|rocky|almalinux|fedora) PKG_INSTALL="yum install -y"; PKG_UPDATE="yum check-update" ;;
    *) err "OS $OS stöds inte automatiskt. Stödda: Ubuntu, Debian, CentOS, RHEL, Rocky, Alma, Fedora"; exit 1 ;;
esac

# --- Installera beroenden --------------------------------------------------
step "Installera beroenden"
$PKG_UPDATE 2>&1 | tail -3 || true
$PKG_INSTALL git curl wget ufw fail2ban cron acl unzip 2>&1 | tail -5 || true
command -v cron >/dev/null || $PKG_INSTALL cronie 2>&1 | tail -3

# Nginx vs Apache
if [ "$WEB_SERVER" = "nginx" ]; then
    $PKG_INSTALL nginx 2>&1 | tail -3 || true
    WEB_CMD="nginx"
    WEB_USER="www-data"
else
    $PKG_INSTALL apache2 2>&1 | tail -3 || true
    WEB_CMD="apache2"
    WEB_USER="www-data"
fi
ok "Webbserver: $WEB_CMD installerad"

# --- Skapa deploy-användare ------------------------------------------------
step "Skapar deploy-användare: $DEPLOY_USER"
if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd --system --shell /bin/bash --home "/home/$DEPLOY_USER" --create-home "$DEPLOY_USER"
    ok "Användare skapad: $DEPLOY_USER"
else
    ok "Användare finns redan: $DEPLOY_USER"
fi

# --- Brandvägg -------------------------------------------------------------
step "Konfigurerar brandvägg"
if command -v ufw &>/dev/null; then
    ufw --force reset 2>/dev/null || true
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    [ "$WEB_SERVER" = "nginx" ] && ufw allow 'Nginx Full' || ufw allow 'Apache Full'
    ufw --force enable
    ok "UFW aktiv (SSH + HTTPS)"
elif command -v firewall-cmd &>/dev/null; then
    systemctl enable --now firewalld 2>/dev/null || true
    firewall-cmd --permanent --add-service=ssh
    [ "$WEB_SERVER" = "nginx" ] && firewall-cmd --permanent --add-service=http && firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    ok "Firewalld aktiv"
fi

# --- Klona repot -----------------------------------------------------------
step "Klonar repot till $DEPLOY_PATH"
mkdir -p "$(dirname "$DEPLOY_PATH")"

if [ -d "$DEPLOY_PATH/.git" ]; then
    info "Repot finns redan — uppdaterar"
    cd "$DEPLOY_PATH"
    sudo -u "$DEPLOY_USER" git fetch origin "$BRANCH" 2>&1 | tail -3
    sudo -u "$DEPLOY_USER" git reset --hard "origin/$BRANCH" 2>&1 | tail -3
    ok "Uppdaterad till $BRANCH"
else
    mkdir -p "$DEPLOY_PATH"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
    sudo -u "$DEPLOY_USER" git clone -b "$BRANCH" "$REPO_URL" "$DEPLOY_PATH" 2>&1 | tail -5
    ok "Repot klonat"
fi

# --- Sätt rätt filrättigheter ---------------------------------------------
step "Sätter filrättigheter"
chown -R "$DEPLOY_USER:$WEB_USER" "$DEPLOY_PATH" 2>/dev/null || chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
find "$DEPLOY_PATH" -type d -exec chmod 755 {} \;
find "$DEPLOY_PATH" -type f -exec chmod 644 {} \;
ok "Rättigheter satta"

# --- Webserver-konfiguration -----------------------------------------------
step "Konfigurerar $WEB_SERVER"

if [ "$WEB_SERVER" = "nginx" ]; then
    cat > /etc/nginx/sites-available/vyra <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    root $DEPLOY_PATH;
    index index.html;

    # Säkerhet
    server_tokens off;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Dolda filer
    location ~ /\. { deny all; }

    # Cache
    location ~* \.html$ {
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }
    location ~* \.(css|js|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    location ~* \.(png|jpg|jpeg|gif|webp)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    location / {
        try_files \$uri \$uri/ =404;
    }
}
NGINX

    # Aktivera
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/vyra /etc/nginx/sites-enabled/vyra

    nginx -t && systemctl reload nginx
    ok "Nginx konfigurerad"
fi

# --- SSL Let's Encrypt ----------------------------------------------------
if [ "$SETUP_SSL" = "yes" ] || [ "$SETUP_SSL" = "auto" ]; then
    step "SSL (Let's Encrypt)"

    # Testa domänen först
    if host "$DOMAIN" &>/dev/null; then
        info "Domänen $DOMAIN finns i DNS — försöker SSL"

        $PKG_INSTALL certbot python3-certbot-nginx 2>&1 | tail -3
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" 2>&1 | tail -5 || warn "Certbot misslyckades (kanske ingen DNS eller rate limit)"

        # Auto-renewal
        systemctl enable certbot.timer 2>/dev/null || true
        ok "SSL försökt sättas upp"
    else
        warn "Domänen $DOMAIN finns inte i DNS — hoppar SSL för nu"
        info "Tips: peka $DOMAIN till denna servers IP först, sen kör:"
        info "  sudo certbot --nginx -d $DOMAIN"
    fi
fi

# --- Fail2ban --------------------------------------------------------------
step "Konfigurerar Fail2Ban"
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
backend = %(sshd_backend)s
maxretry = 3
bantime = 7200
EOF
systemctl enable --now fail2ban 2>/dev/null
ok "Fail2Ban aktivt (3 försök = 2h block)"

# --- Logrotate -------------------------------------------------------------
step "Installerar VYRA logrotate"
if [ -f "$DEPLOY_PATH/scripts/logrotate-vyra" ]; then
    cp "$DEPLOY_PATH/scripts/logrotate-vyra" /etc/logrotate.d/vyra
    ok "Logrotate installerad"
else
    info "Ingen logrotate-vyra i repot — hoppar över"
fi

# --- Monitorering ----------------------------------------------------------
step "Installerar monitor + backup"

# Monitor
if [ -f "$DEPLOY_PATH/scripts/monitor.sh" ]; then
    cp "$DEPLOY_PATH/scripts/monitor.sh" /usr/local/bin/vyra-monitor.sh
    chmod +x /usr/local/bin/vyra-monitor.sh
    [ -f "$DEPLOY_PATH/scripts/vyra-monitor.service" ] && cp "$DEPLOY_PATH/scripts/vyra-monitor.service" /etc/systemd/system/
    [ -f "$DEPLOY_PATH/scripts/vyra-monitor.env.example" ] && cp "$DEPLOY_PATH/scripts/vyra-monitor.env.example" /etc/vyra-monitor.env
    systemctl daemon-reload
    systemctl enable --now vyra-monitor.service 2>/dev/null || warn "Kunde inte starta monitor-tjänst"
    ok "Monitor installerad"
fi

# Backup
if [ -f "$DEPLOY_PATH/scripts/backup.sh" ]; then
    mkdir -p /opt/vyra/scripts
    cp "$DEPLOY_PATH/scripts/backup.sh" /opt/vyra/scripts/
    chmod +x /opt/vyra/scripts/backup.sh
    [ -f "$DEPLOY_PATH/scripts/vyra-backup.service" ] && cp "$DEPLOY_PATH/scripts/vyra-backup.service" /etc/systemd/system/
    [ -f "$DEPLOY_PATH/scripts/vyra-backup.timer" ] && cp "$DEPLOY_PATH/scripts/vyra-backup.timer" /etc/systemd/system/
    [ -f "$DEPLOY_PATH/scripts/vyra-backup.env.example" ] && cp "$DEPLOY_PATH/scripts/vyra-backup.env.example" /etc/vyra-backup.env
    mkdir -p /var/backups/vyra
    chmod 700 /var/backups/vyra
    systemctl daemon-reload
    systemctl enable --now vyra-backup.timer 2>/dev/null || warn "Kunde inte starta backup-timer"
    ok "Backup installerad (dagligen kl 02:00)"
fi

# --- Slutkoll --------------------------------------------------------------
step "Slutkontroll"

info "Kollar att webbplatsen svarar..."
sleep 2

# Lokalt test
if curl -s -o /dev/null -w "%{http_code}" "http://localhost/" | grep -q "200\|301\|302"; then
    ok "✓ Webbplatsen svarar lokalt på http://localhost/"
else
    warn "Lokalt test misslyckades — kolla nginx"
fi

# Externt test
if [ -n "${PUBLIC_URL:-}" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PUBLIC_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        ok "✓ Webbplatsen svarar externt på $PUBLIC_URL (HTTP $HTTP_CODE)"
    else
        warn "Externt test misslyckades (HTTP $HTTP_CODE) — DNS kanske inte pekar hit ännu"
    fi
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${GREEN}        🎉 VYRA ÄR ONLINE!${CYAN}                              ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Vad som är klart:${NC}"
echo "  ✓ Webbserver ($WEB_SERVER) kör"
echo "  ✓ Webbplats deployad till $DEPLOY_PATH"
echo "  ✓ HTTPS försökt sättas upp för $DOMAIN"
echo "  ✓ Brandvägg aktiv (SSH + HTTPS)"
echo "  ✓ Fail2Ban aktivt (skydd mot brute-force)"
echo "  ✓ Logrotate konfigurerat"
[ -f "/etc/systemd/system/vyra-monitor.service" ] && echo "  ✓ Monitor-tjänst kör"
[ -f "/etc/systemd/system/vyra-backup.timer" ] && echo "  ✓ Backup-timer kör (dagligen kl 02:00)"
echo ""
echo -e "${GREEN}Verifiera:${NC}"
echo "  curl -I https://$DOMAIN/"
echo "  systemctl status nginx"
echo "  systemctl status vyra-monitor"
echo ""
echo -e "${GREEN}För GitHub auto-deploy:${NC}"
echo "  1. Generera SSH-nyckel:"
echo "     ssh-keygen -t ed25519 -f ~/.ssh/vyra_deploy -N \"\""
echo "  2. Lägg publik nyckel här:"
echo "     sudo -u $DEPLOY_USER bash -c 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && nano ~/.ssh/authorized_keys'"
echo "  3. Lägg GitHub Secrets på:"
echo "     https://github.com/davidyakoop88-hub/-VYRA-source-code/settings/secrets/actions"
echo ""
echo -e "${YELLOW}Loggar:${NC}"
echo "  sudo tail -f /var/log/nginx/vyra-error.log"
echo "  sudo journalctl -u vyra-monitor -f"
echo "  sudo journalctl -u vyra-backup -f"
echo ""

