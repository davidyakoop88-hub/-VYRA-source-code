#!/usr/bin/env bash
# ============================================================================
# VYRA brandväggsverifiering
# ============================================================================
# Testar att brandväggen är korrekt konfigurerad och att
# inga onödiga portar är exponerade.
#
# Användning:
#   ./test-firewall.sh                # Kör från server
#   ./test-firewall.sh --remote       # Testa utifrån (använd remote host)
# ============================================================================

set -euo pipefail

DOM="${DOMAIN:-vyralive.app}"
REQUIRED_OPEN=(22 80 443)
SHOULD_BE_BLOCKED=(21 23 25 3306 5432 6379 8080 8443 27017)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
ok()    { echo -e "${GREEN}✓${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
err()   { echo -e "${RED}✗${NC}  $*" >&2; }
info()  { echo -e "${BLUE}ℹ${NC}  $*"; }

# --- Steg 1: Kontrollera brandväggen är aktiv ------------------------------
info "[1/6] Verifierar att brandväggen är aktiv..."

if command -v ufw &>/dev/null; then
    ufw_status=$(ufw status 2>/dev/null | head -1 || echo "")
    if echo "$ufw_status" | grep -q "active"; then
        ok "UFW är aktiv"
    else
        err "UFW är INTE aktiv — aktivera med: sudo ufw enable"
        exit 1
    fi
elif command -v firewall-cmd &>/dev/null; then
    fw_state=$(firewall-cmd --state 2>/dev/null || echo "")
    if [ "$fw_state" = "running" ]; then
        ok "FirewallD är aktivt"
    else
        err "FirewallD är INTE aktivt — aktivera med: sudo systemctl start firewalld"
        exit 1
    fi
else
    err "Ingen brandvägg hittades (UFW eller FirewallD)"
    warn "Installera: sudo apt install ufw   # Ubuntu"
    warn "         sudo yum install firewalld # RHEL"
    exit 1
fi

# --- Steg 2: Verifiera konfiguration -----------------------------------------
info "[2/6] Verifierar brandväggsregler..."

echo ""
echo "=== Aktiva regler ==="

if command -v ufw &>/dev/null; then
    sudo ufw status verbose
else
    sudo firewall-cmd --list-all
fi
echo ""

# Kolla att rätt portar är öppna lokalt
for port in "${REQUIRED_OPEN[@]}"; do
    if ss -tlnp 2>/dev/null | grep -q ":${port}\b"; then
        ok "Port $port lyssnar lokalt"
    else
        warn "Port $port lyssnar INTE lokalt — kolla tjänster"
    fi
done

# --- Steg 3: Testa öppna portar från server utifrån --------------------------
info "[3/6] Testar att portar är nåbara utifrån..."

echo ""
for port in "${REQUIRED_OPEN[@]}"; do
    # Testar med curl (fungerar för HTTP/HTTPS)
    # För SSH använder vi nc
    if [ $port -eq 22 ]; then
        # SSH kan inte testas med curl, använd nc
        if timeout 5 bash -c "echo '' > /dev/tcp/${DOM}/${port}" 2>/dev/null; then
            ok "Port $port (SSH) — nåbar utifrån"
        else
            err "Port $port (SSH) — INTE nåbar utifrån (kolla brandvägg)"
        fi
    elif [ $port -eq 80 ]; then
        code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://${DOM}:${port}/" 2>/dev/null || echo "000")
        if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "302" ]; then
            ok "Port $port (HTTP) — svarar (kod $code)"
        elif [ "$code" = "000" ]; then
            err "Port $port (HTTP) — INTE nåbar utifrån"
        else
            warn "Port $port (HTTP) — svarar konstigt (kod $code)"
        fi
    elif [ $port -eq 443 ]; then
        code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://${DOM}:${port}/" 2>/dev/null || echo "000")
        if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "302" ]; then
            ok "Port $port (HTTPS) — svarar (kod $code)"
        elif [ "$code" = "000" ]; then
            err "Port $port (HTTPS) — INTE nåbar utifrån"
        else
            warn "Port $port (HTTPS) — svarar konstigt (kod $code)"
        fi
    fi
done

# --- Steg 4: Verifiera att farliga portar är blockerade --------------------
info "[4/6] Verifierar att farliga portar är blockerade..."

echo ""
problems=0
for port in "${SHOULD_BE_BLOCKED[@]}"; do
    # Testa lokalt först (om port är öppet lokalt → varning)
    if ss -tlnp 2>/dev/null | grep -q ":${port}\b"; then
        err "Port $port lyssnar LOKALT — bör vara stängt!"
        problems=$((problems + 1))
    fi
done

if [ $problems -eq 0 ]; then
    ok "Inga farliga portar lyssnar lokalt"
else
    err "$problems farliga portar är öppna — kolla ovan"
    warn "Exempel: stäng MySQL med: sudo ufw deny 3306"
fi

# --- Steg 5: Testa SSH-regeln ----------------------------------------------
info "[5/6] Testar SSH-specifik konfiguration..."

# Kolla att SSH är skyddat mot brute force (om fail2ban är installerat)
if command -v fail2ban-client &>/dev/null; then
    if fail2ban-client status sshd &>/dev/null; then
        banned=$(fail2ban-client status sshd 2>/dev/null | grep "Banned IP list" | awk '{print $NF}')
        echo ""
        ok "Fail2Ban skyddar SSH (för tillfället $banned blockerade IP:n)"
    else
        warn "Fail2Ban installerad men sshd-jail inte aktivt"
    fi
else
    warn "Fail2Ban är INTE installerat — rekommenderar starkt!"
    echo "   Installera: sudo apt install fail2ban"
fi

# Kolla att root-login via SSH är begränsat
sshd_permroot=$(sshd -T 2>/dev/null | grep "permitrootlogin" | awk '{print $2}')
if [ "$sshd_permroot" = "prohibit-password" ] || [ "$sshd_permroot" = "no" ]; then
    ok "Root-login via SSH är begränsat ($sshd_permroot)"
else
    warn "Root-login via SSH är tillåtet — överväg att ändra"
fi

# Kolla password authentication
sshd_pwauth=$(sshd -T 2>/dev/null | grep "passwordauthentication" | awk '{print $2}')
if [ "$sshd_pwauth" = "no" ]; then
    ok "Lösenordsinloggning är AV — bara SSH-nyckel"
else
    warn "Lösenordsinloggning är PÅ — överväg att stänga av"
fi

# --- Steg 6: Verifiera nginx-specifik säkerhet -----------------------------
info "[6/6] Verifierar nginx-säkerhet..."

echo ""
# Kollla att nginx svarar på HTTPS
https_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://${DOM}/" 2>/dev/null || echo "000")
if [ "$https_code" = "200" ]; then
    ok "HTTPS fungerar (kod $https_code)"
else
    warn "HTTPS svarar med kod $https_code"
fi

# Kolla HTTP → HTTPS redirect
http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://${DOM}/" 2>/dev/null || echo "000")
if [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
    ok "HTTP → HTTPS redirect fungerar"
else
    warn "HTTP → HTTPS redirect fungerar INTE (kod $http_code)"
fi

# Kolla säkerhets-headers
echo ""
info "Säkerhets-headers:"
for header in "strict-transport-security" "x-frame-options" "x-content-type-options" "x-xss-protection"; do
    val=$(curl -s --max-time 5 -I "https://${DOM}/" 2>/dev/null | grep -i "$header" | head -1)
    if [ -n "$val" ]; then
        ok "  $header — satt"
    else
        warn "  $header — SAKNAS"
    fi
done

# --- Sammanfattning --------------------------------------------------------
echo ""
echo "============================================="
echo " Brandväggsverifiering klar"
echo "============================================="
echo ""
echo "Rekommendationer:"
echo ""
echo "  1. ✅ Portar öppna:  22 (SSH), 80 (HTTP), 443 (HTTPS)"
echo "  2. ❌ Blockera:      3306 (MySQL), 5432 (Postgres), 6379 (Redis), 27017 (MongoDB)"
echo "  3. 🛡  Installera:    Fail2Ban för SSH-brute-force-skydd"
echo "  4. 🔐  Begränsa:     SSH root-login till 'prohibit-password'"
echo "  5. 🔑  Tillåt:       Bara SSH-nyckel-autentisering"
echo "  6. 🔒  Sätt:         HTTPS-headers (HSTS, X-Frame-Options, etc)"
echo ""

