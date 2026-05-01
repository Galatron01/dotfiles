#!/usr/bin/env bash
set -euo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="$HOME/.dotfiles-backup/$(date +%Y%m%d-%H%M%S)"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

step() { echo -e "\n${BOLD}${CYAN}==> $*${RESET}"; }
ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}!${RESET}  $*"; }
die()  { echo -e "  ${RED}✗  $*${RESET}"; exit 1; }
ask()  { echo -e "\n${BOLD}$*${RESET} [y/N] "; read -r ans; [[ "$ans" =~ ^[Yy]$ ]]; }

# ── Sanity check ──────────────────────────────────────────────────────────────
[[ -f /etc/arch-release ]] || die "This script is for Arch-based systems only"
[[ $EUID -ne 0 ]] || die "Do not run as root — sudo will be used where needed"

# ── What to install ───────────────────────────────────────────────────────────
echo -e "\n${BOLD}${CYAN}redfive dotfiles installer${RESET}"
echo -e "${CYAN}──────────────────────────────────────────${RESET}"

INSTALL_CORE=true
INSTALL_PENTEST=false
INSTALL_DESKTOP=false
INSTALL_AUR=false

ask "Install pentest tools (nmap, ffuf, gobuster, sslscan...)?" && INSTALL_PENTEST=true || true
ask "Install desktop environment (KDE, Niri, Waybar...)?"     && INSTALL_DESKTOP=true || true
ask "Install AUR packages (postman, thorium, matugen...)?"     && INSTALL_AUR=true     || true

# ── Install paru (AUR helper) ─────────────────────────────────────────────────
step "Checking for AUR helper"
if ! command -v paru &>/dev/null && ! command -v yay &>/dev/null; then
    warn "No AUR helper found — installing paru"
    sudo pacman -S --needed --noconfirm git base-devel
    tmpdir=$(mktemp -d)
    git clone https://aur.archlinux.org/paru.git "$tmpdir/paru"
    (cd "$tmpdir/paru" && makepkg -si --noconfirm)
    rm -rf "$tmpdir"
    ok "paru installed"
else
    ok "AUR helper present"
fi

AUR_CMD=$(command -v paru || command -v yay)

# ── Helper: install package list from file ────────────────────────────────────
install_pkgs() {
    local file="$1"
    # Strip comments and blank lines
    local pkgs
    pkgs=$(grep -v '^\s*#' "$file" | grep -v '^\s*$' | tr '\n' ' ')
    [[ -z "$pkgs" ]] && return
    # shellcheck disable=SC2086
    sudo pacman -S --needed --noconfirm $pkgs 2>/dev/null || \
        $AUR_CMD -S --needed --noconfirm $pkgs
}

# ── Packages ──────────────────────────────────────────────────────────────────
step "Installing core packages"
install_pkgs "$DOTFILES/packages-core.txt"
ok "Core packages done"

if $INSTALL_PENTEST; then
    step "Installing pentest tools"
    install_pkgs "$DOTFILES/packages-pentest.txt"
    ok "Pentest tools done"
fi

if $INSTALL_DESKTOP; then
    step "Installing desktop packages"
    install_pkgs "$DOTFILES/packages-desktop.txt"
    ok "Desktop packages done"
fi

if $INSTALL_AUR; then
    step "Installing AUR packages"
    grep -v '^\s*#' "$DOTFILES/packages-aur.txt" | grep -v '^\s*$' | while read -r pkg; do
        $AUR_CMD -S --needed --noconfirm "$pkg" || warn "AUR package $pkg failed — skipping"
    done
    ok "AUR packages done"
fi

# ── Symlink helper ────────────────────────────────────────────────────────────
link() {
    local src="$1" dst="$2"
    if [[ -e "$dst" && ! -L "$dst" ]]; then
        mkdir -p "$(dirname "$BACKUP/$dst")"
        cp -r "$dst" "$BACKUP/$dst" 2>/dev/null || true
        warn "Backed up existing $(basename "$dst") → $BACKUP"
    fi
    mkdir -p "$(dirname "$dst")"
    ln -sf "$src" "$dst"
    ok "Linked $dst"
}

# ── Dotfiles symlinks ─────────────────────────────────────────────────────────
step "Linking dotfiles"

# tmux
link "$DOTFILES/home/.tmux.conf"                   "$HOME/.tmux.conf"
link "$DOTFILES/home/.tmux/pentest.sh"             "$HOME/.tmux/pentest.sh"
link "$DOTFILES/home/.tmux/session-manager.sh"     "$HOME/.tmux/session-manager.sh"
chmod +x "$HOME/.tmux/pentest.sh" "$HOME/.tmux/session-manager.sh"

# fish
link "$DOTFILES/config/fish/config.fish"                       "$HOME/.config/fish/config.fish"
link "$DOTFILES/config/fish/conf.d/00_init.fish"               "$HOME/.config/fish/conf.d/00_init.fish"
link "$DOTFILES/config/fish/conf.d/10-aliases.fish"            "$HOME/.config/fish/conf.d/10-aliases.fish"
link "$DOTFILES/config/fish/conf.d/20-customization.fish"      "$HOME/.config/fish/conf.d/20-customization.fish"
link "$DOTFILES/config/fish/conf.d/30-autostart.fish"          "$HOME/.config/fish/conf.d/30-autostart.fish"
link "$DOTFILES/config/fish/conf.d/40-abbreviations.fish"      "$HOME/.config/fish/conf.d/40-abbreviations.fish"
link "$DOTFILES/config/fish/functions/mkclient.fish"           "$HOME/.config/fish/functions/mkclient.fish"
link "$DOTFILES/config/fish/functions/vpn.fish"                "$HOME/.config/fish/functions/vpn.fish"
link "$DOTFILES/config/fish/functions/nmap.fish"               "$HOME/.config/fish/functions/nmap.fish"
link "$DOTFILES/config/fish/functions/gobuster.fish"           "$HOME/.config/fish/functions/gobuster.fish"
link "$DOTFILES/config/fish/functions/ffuf.fish"               "$HOME/.config/fish/functions/ffuf.fish"
link "$DOTFILES/config/fish/functions/ports.fish"              "$HOME/.config/fish/functions/ports.fish"

# oh-my-posh config
link "$DOTFILES/config/ohmyposh/zen.toml"  "$HOME/.config/ohmyposh/zen.toml"

# color scripts
link "$DOTFILES/local/bin/nmap-color"      "$HOME/.local/bin/nmap-color"
link "$DOTFILES/local/bin/gobuster-color"  "$HOME/.local/bin/gobuster-color"
link "$DOTFILES/local/bin/ffuf-color"      "$HOME/.local/bin/ffuf-color"
chmod +x "$HOME/.local/bin/nmap-color" "$HOME/.local/bin/gobuster-color" "$HOME/.local/bin/ffuf-color"

ok "All dotfiles linked"

# ── oh-my-posh ────────────────────────────────────────────────────────────────
step "Installing oh-my-posh"
if [[ ! -f "$HOME/.local/bin/oh-my-posh" ]]; then
    curl -s https://ohmyposh.dev/install.sh | bash -s -- -d "$HOME/.local/bin"
    ok "oh-my-posh installed"
else
    ok "oh-my-posh already present"
fi

# ── Fish as default shell ─────────────────────────────────────────────────────
step "Setting fish as default shell"
FISH_PATH=$(command -v fish)
if ! grep -q "$FISH_PATH" /etc/shells; then
    echo "$FISH_PATH" | sudo tee -a /etc/shells
fi
if [[ "$SHELL" != "$FISH_PATH" ]]; then
    chsh -s "$FISH_PATH"
    ok "Default shell set to fish (takes effect on next login)"
else
    ok "fish is already the default shell"
fi

# ── Tmux Plugin Manager ───────────────────────────────────────────────────────
step "Installing tmux plugins (TPM)"
if [[ ! -d "$HOME/.tmux/plugins/tpm" ]]; then
    git clone https://github.com/tmux-plugins/tpm "$HOME/.tmux/plugins/tpm"
    ok "TPM cloned"
else
    ok "TPM already present"
fi
# Install plugins headlessly
if command -v tmux &>/dev/null; then
    "$HOME/.tmux/plugins/tpm/bin/install_plugins" 2>/dev/null && ok "Tmux plugins installed" || warn "Run prefix+I inside tmux to install plugins"
fi

# ── jsintel ───────────────────────────────────────────────────────────────────
step "Setting up jsintel"
JSINTEL_SRC="$DOTFILES/jsintel"
JSINTEL_DST="$HOME/jsintel"
if [[ ! -d "$JSINTEL_DST" ]]; then
    cp -r "$JSINTEL_SRC" "$JSINTEL_DST"
fi
chmod +x "$JSINTEL_DST/bin/jsintel.js"
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
(cd "$JSINTEL_DST" && npm link)
ok "jsintel linked globally — run: jsintel --help"

# ── Go + httpx ────────────────────────────────────────────────────────────────
step "Installing httpx via Go"
if command -v go &>/dev/null; then
    if ! command -v httpx &>/dev/null; then
        go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
        # Add ~/go/bin to fish PATH
        if ! grep -q 'go/bin' "$HOME/.config/fish/conf.d/00_init.fish" 2>/dev/null; then
            echo -e "\nfish_add_path \$HOME/go/bin" >> "$DOTFILES/config/fish/conf.d/00_init.fish"
        fi
        ok "httpx installed → ~/go/bin/httpx"
    else
        ok "httpx already present"
    fi
else
    warn "go not found — install go then run: go install github.com/projectdiscovery/httpx/cmd/httpx@latest"
fi

# ── Create client directories ─────────────────────────────────────────────────
step "Creating pentest directories"
mkdir -p "$HOME/Documents/Clients"
mkdir -p "$HOME/Documents/lists"
ok "~/Documents/Clients ready"

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}══════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Done! Machine setup complete.${RESET}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${RESET}"
echo -e ""
echo -e "  ${CYAN}Next steps:${RESET}"
echo -e "  1. Copy your VPN config:  ${YELLOW}~/.config/openvpn/client.conf${RESET}"
echo -e "  2. Start a new shell or run: ${YELLOW}exec fish${RESET}"
echo -e "  3. Open tmux and press ${YELLOW}Ctrl+S then I${RESET} to install plugins"
echo -e "  4. Test pentest launcher: ${YELLOW}Ctrl+S then Ctrl+T${RESET}"
echo -e ""
