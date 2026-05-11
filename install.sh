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

[[ $EUID -ne 0 ]] || die "Do not run as root — sudo will be used where needed"

# ── Detect distro ─────────────────────────────────────────────────────────────
step "Detecting OS"
DISTRO=""
PKG_MANAGER=""

if [[ -f /etc/arch-release ]]; then
    DISTRO="arch"
    PKG_MANAGER="pacman"
elif [[ -f /etc/debian_version ]]; then
    DISTRO="debian"
    PKG_MANAGER="apt"
    . /etc/os-release 2>/dev/null || true
    DISTRO_NAME="${NAME:-Debian}"
elif [[ -f /etc/fedora-release ]]; then
    DISTRO="fedora"
    PKG_MANAGER="dnf"
elif [[ -f /etc/redhat-release ]]; then
    DISTRO="rhel"
    PKG_MANAGER="dnf"
elif [[ -f /etc/opensuse-release ]] || grep -qi opensuse /etc/os-release 2>/dev/null; then
    DISTRO="opensuse"
    PKG_MANAGER="zypper"
else
    warn "Unknown distro — will attempt best-effort install"
    DISTRO="unknown"
fi
ok "Detected: $DISTRO ($PKG_MANAGER)"

# ── What to install ───────────────────────────────────────────────────────────
echo -e "\n${BOLD}${CYAN}redfive dotfiles installer${RESET}"
echo -e "${CYAN}──────────────────────────────────────────${RESET}"

INSTALL_PENTEST=false
INSTALL_DESKTOP=false
INSTALL_AUR=false

ask "Install pentest tools (nmap, ffuf, gobuster, sslscan...)?" && INSTALL_PENTEST=true || true
ask "Install desktop environment (KDE, Niri, Waybar...)?"      && INSTALL_DESKTOP=true || true
[[ "$DISTRO" == "arch" ]] && { ask "Install AUR packages (postman, thorium, matugen...)?" && INSTALL_AUR=true || true; }

# ── Package installer wrappers ────────────────────────────────────────────────
pkg_update() {
    case $DISTRO in
        arch)    sudo pacman -Sy ;;
        debian)  sudo apt-get update ;;
        fedora|rhel) sudo dnf check-update || true ;;
        opensuse) sudo zypper refresh ;;
    esac
}

pkg_install() {
    # Filters out empty strings and installs remaining packages
    local pkgs=()
    for p in "$@"; do [[ -n "$p" ]] && pkgs+=("$p"); done
    [[ ${#pkgs[@]} -eq 0 ]] && return
    case $DISTRO in
        arch)    sudo pacman -S --needed --noconfirm "${pkgs[@]}" ;;
        debian)  sudo apt-get install -y "${pkgs[@]}" ;;
        fedora|rhel) sudo dnf install -y "${pkgs[@]}" ;;
        opensuse) sudo zypper install -y "${pkgs[@]}" ;;
        *)       warn "Unknown distro — skipping package install for: ${pkgs[*]}" ;;
    esac
}

# Try installing a package, warn and continue if it fails
pkg_try() {
    local pkg="$1"
    [[ -z "$pkg" ]] && return
    case $DISTRO in
        arch)    sudo pacman -S --needed --noconfirm "$pkg" 2>/dev/null && ok "$pkg installed" || warn "$pkg not found in repos — skipping" ;;
        debian)  sudo apt-get install -y "$pkg" 2>/dev/null && ok "$pkg installed" || warn "$pkg not found in repos — skipping" ;;
        fedora|rhel) sudo dnf install -y "$pkg" 2>/dev/null && ok "$pkg installed" || warn "$pkg not found in repos — skipping" ;;
        opensuse) sudo zypper install -y "$pkg" 2>/dev/null && ok "$pkg installed" || warn "$pkg not found in repos — skipping" ;;
    esac
}

# ── AUR helper (Arch only) ────────────────────────────────────────────────────
AUR_CMD=""
if [[ "$DISTRO" == "arch" ]]; then
    step "Checking for AUR helper"
    if command -v paru &>/dev/null; then
        AUR_CMD="paru"; ok "paru found"
    elif command -v yay &>/dev/null; then
        AUR_CMD="yay"; ok "yay found"
    else
        warn "No AUR helper found — installing paru"
        sudo pacman -S --needed --noconfirm git base-devel
        tmpdir=$(mktemp -d)
        git clone https://aur.archlinux.org/paru.git "$tmpdir/paru"
        (cd "$tmpdir/paru" && makepkg -si --noconfirm)
        rm -rf "$tmpdir"
        AUR_CMD="paru"; ok "paru installed"
    fi
fi

aur_install() {
    [[ "$DISTRO" != "arch" || -z "$AUR_CMD" ]] && return
    $AUR_CMD -S --needed --noconfirm "$@"
}

# ── Go install helper ─────────────────────────────────────────────────────────
go_install() {
    local pkg="$1" bin="$2"
    if command -v "$bin" &>/dev/null; then
        ok "$bin already installed"; return
    fi
    if ! command -v go &>/dev/null; then
        warn "go not found — skipping $bin (install go first)"; return
    fi
    ok "Installing $bin via go..."
    GOPATH="$HOME/go" go install -v "$pkg" 2>/dev/null && ok "$bin installed" || warn "Failed to install $bin"
}

# ── GitHub release download helper ───────────────────────────────────────────
gh_release() {
    # gh_release <repo> <pattern> <dest_binary>
    local repo="$1" pattern="$2" dest="$3"
    local bin_name; bin_name=$(basename "$dest")
    if command -v "$bin_name" &>/dev/null || [[ -f "$dest" ]]; then
        ok "$bin_name already installed"; return
    fi
    ok "Downloading $bin_name from GitHub..."
    local url
    url=$(curl -s "https://api.github.com/repos/$repo/releases/latest" \
        | grep browser_download_url \
        | grep "$pattern" \
        | head -1 \
        | cut -d'"' -f4)
    if [[ -z "$url" ]]; then
        warn "Could not find release for $bin_name — install manually"; return
    fi
    mkdir -p "$(dirname "$dest")"
    curl -sL "$url" -o "/tmp/$bin_name.download"
    # Handle tar.gz
    if [[ "$url" == *.tar.gz ]]; then
        tar -xzf "/tmp/$bin_name.download" -C /tmp/
        find /tmp -maxdepth 2 -name "$bin_name" -type f -exec mv {} "$dest" \;
    else
        mv "/tmp/$bin_name.download" "$dest"
    fi
    chmod +x "$dest"
    rm -f "/tmp/$bin_name.download"
    ok "$bin_name installed to $dest"
}

# ── Update package lists ──────────────────────────────────────────────────────
step "Updating package lists"
pkg_update

# ── Core packages ─────────────────────────────────────────────────────────────
step "Installing core packages"

case $DISTRO in
arch)
    pkg_install \
        base base-devel git curl wget less which man-db man-pages sudo \
        openssh networkmanager iwd openvpn networkmanager-openvpn xl2tpd \
        fish tmux fzf zoxide ripgrep bat eza rsync pv duf tty-clock \
        neovim vim nano micro btop htop fastfetch yazi \
        python python-pip python-defusedxml python-packaging \
        nodejs npm unrar unzip cronie logrotate bind ufw ufw-extras go
    ;;
debian)
    pkg_install \
        build-essential git curl wget less man-db sudo \
        openssh-client network-manager openvpn network-manager-openvpn \
        fish tmux fzf zoxide ripgrep bat rsync pv \
        neovim vim nano btop htop \
        wl-clipboard python3 python3-pip python3-defusedxml python3-gi gir1.2-gtk-4.0 \
        nodejs npm unrar unzip cron logrotate dnsutils ufw golang-go
    # eza: in apt on Ubuntu 23.10+, otherwise install via cargo or binary
    if ! pkg_try eza; then
        if command -v cargo &>/dev/null; then
            cargo install eza && ok "eza installed via cargo"
        else
            gh_release "eza-community/eza" "linux-x86_64.tar.gz" "$HOME/.local/bin/eza"
        fi
    fi
    # micro: try apt, fallback to direct install
    pkg_try micro || curl https://getmic.ro | bash && mv micro "$HOME/.local/bin/" 2>/dev/null || true
    # fastfetch: not in apt, use GitHub release
    if ! command -v fastfetch &>/dev/null; then
        gh_release "fastfetch-cli/fastfetch" "linux-amd64.deb" "/tmp/fastfetch.deb"
        sudo dpkg -i /tmp/fastfetch.deb 2>/dev/null || warn "fastfetch install failed — skipping"
    fi
    # tty-clock
    pkg_try tty-clock || warn "tty-clock not available — clock alias won't work"
    # duf
    pkg_try duf || gh_release "muesli/duf" "linux_x86_64.deb" "/tmp/duf.deb" && sudo dpkg -i /tmp/duf.deb 2>/dev/null || true
    # yazi: not in apt, use GitHub release
    if ! command -v yazi &>/dev/null; then
        gh_release "sxyazi/yazi" "x86_64-unknown-linux-gnu.tar.gz" "$HOME/.local/bin/yazi"
    fi
    ;;
fedora|rhel)
    pkg_install \
        git curl wget less man-db sudo \
        openssh NetworkManager openvpn NetworkManager-openvpn \
        fish tmux fzf zoxide ripgrep bat eza rsync pv \
        neovim vim nano micro btop htop fastfetch \
        python3 python3-pip \
        nodejs npm unrar unzip cronie logrotate bind-utils ufw golang
    # tty-clock
    pkg_try tty-clock || warn "tty-clock not available — clock alias won't work"
    # duf
    pkg_try duf || gh_release "muesli/duf" "linux_x86_64.rpm" "/tmp/duf.rpm" && sudo rpm -i /tmp/duf.rpm 2>/dev/null || true
    # yazi
    if ! command -v yazi &>/dev/null; then
        gh_release "sxyazi/yazi" "x86_64-unknown-linux-gnu.tar.gz" "$HOME/.local/bin/yazi"
    fi
    ;;
opensuse)
    pkg_install \
        git curl wget less man sudo \
        openssh NetworkManager openvpn NetworkManager-openvpn \
        fish tmux fzf zoxide ripgrep bat eza rsync pv \
        neovim vim nano btop htop \
        python3 python3-pip \
        nodejs npm unzip cronie logrotate bind-utils ufw go
    pkg_try fastfetch || gh_release "fastfetch-cli/fastfetch" "linux-amd64.tar.gz" "$HOME/.local/bin/fastfetch"
    pkg_try tty-clock || warn "tty-clock not available"
    pkg_try duf        || gh_release "muesli/duf" "linux_x86_64.tar.gz" "$HOME/.local/bin/duf"
    pkg_try micro      || curl https://getmic.ro | bash && mv micro "$HOME/.local/bin/" 2>/dev/null || true
    if ! command -v yazi &>/dev/null; then
        gh_release "sxyazi/yazi" "x86_64-unknown-linux-gnu.tar.gz" "$HOME/.local/bin/yazi"
    fi
    ;;
esac
ok "Core packages done"

# ── Pentest tools ─────────────────────────────────────────────────────────────
if $INSTALL_PENTEST; then
    step "Installing pentest tools"
    case $DISTRO in
    arch)
        pkg_install nmap sslscan sslyze testssl.sh feroxbuster ffuf gobuster dirbuster
        ;;
    debian)
        pkg_install nmap
        pkg_try sslscan  || warn "sslscan not in repos — install manually"
        pkg_try dirbuster || true
        # sslyze via pip
        pip3 install sslyze --quiet && ok "sslyze installed via pip" || warn "sslyze pip install failed"
        # testssl.sh — download script directly
        if ! command -v testssl.sh &>/dev/null && ! command -v testssl &>/dev/null; then
            curl -sL https://testssl.sh/testssl.sh -o "$HOME/.local/bin/testssl.sh"
            chmod +x "$HOME/.local/bin/testssl.sh"
            ok "testssl.sh installed to ~/.local/bin/testssl.sh"
        fi
        ;;
    fedora|rhel)
        pkg_install nmap
        pkg_try sslscan  || warn "sslscan not in repos"
        pkg_try testssl  || true
        pip3 install sslyze --quiet && ok "sslyze installed via pip" || warn "sslyze pip install failed"
        ;;
    opensuse)
        pkg_install nmap
        pkg_try sslscan || warn "sslscan not in repos"
        pip3 install sslyze --quiet && ok "sslyze installed via pip" || true
        ;;
    esac

    # ffuf, gobuster, feroxbuster — install via Go on non-Arch (not in standard repos)
    if [[ "$DISTRO" != "arch" ]]; then
        step "Installing Go-based pentest tools"
        go_install "github.com/ffuf/ffuf/v2@latest"                                    "ffuf"
        go_install "github.com/OJ/gobuster/v3@latest"                                  "gobuster"
        go_install "github.com/epi052/feroxbuster@latest"                              "feroxbuster" || \
            gh_release "epi052/feroxbuster" "linux-amd64.tar.gz" "$HOME/.local/bin/feroxbuster"
    fi
    ok "Pentest tools done"
fi

# ── Desktop packages ──────────────────────────────────────────────────────────
if $INSTALL_DESKTOP; then
    step "Installing desktop packages"
    case $DISTRO in
    arch)
        pkg_install \
            plasma-desktop plasma-nm plasma-pa plasma-firewall plasma-systemmonitor \
            plasma-login-manager plasma-browser-integration kdeplasma-addons \
            breeze-gtk kde-gtk-config kdeconnect polkit-kde-agent kwallet-pam \
            powerdevil kwalletmanager kscreen kinfocenter kdialog kio-admin \
            kcalc kate dolphin ark spectacle gwenview filelight partitionmanager \
            xorg-xwayland xdg-desktop-portal-wlr xdg-user-dirs \
            waybar wofi uwsm niri wl-clipboard wlsunset swaync \
            cliphist copyq flameshot satty brightnessctl playerctl gum \
            alacritty kitty konsole \
            pipewire-alsa pipewire-pulse wireplumber pavucontrol alsa-utils \
            vlc haruna gst-libav gst-plugin-pipewire gst-plugins-bad gst-plugins-ugly \
            noto-fonts noto-fonts-emoji ttf-jetbrains-mono ttf-meslo-nerd \
            ttf-dejavu ttf-liberation ttf-opensans cantarell-fonts \
            papirus-icon-theme firefox flatpak bluez bluez-utils
        ;;
    debian)
        pkg_install \
            plasma-desktop plasma-nm plasma-pa \
            kde-standard dolphin kate konsole spectacle \
            xwayland xdg-user-dirs \
            waybar wofi wl-clipboard wlsunset \
            flameshot brightnessctl playerctl \
            kitty \
            pipewire pipewire-pulse wireplumber pavucontrol alsa-utils \
            vlc gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav \
            fonts-noto fonts-noto-color-emoji fonts-jetbrains-mono \
            fonts-dejavu fonts-liberation papirus-icon-theme \
            firefox-esr flatpak bluez python3-gi gir1.2-gtk-4.0
        # alacritty not in apt — install via GitHub release
        if ! command -v alacritty &>/dev/null; then
            gh_release "alacritty/alacritty" "Alacritty-v.*-x86_64-unknown-linux-gnu.tar.gz" "$HOME/.local/bin/alacritty" \
                || warn "alacritty install failed — install manually from https://github.com/alacritty/alacritty/releases"
        fi
        # niri not in apt — install via GitHub release
        if ! command -v niri &>/dev/null; then
            gh_release "YaLTeR/niri" "niri-x86_64-unknown-linux-gnu.tar.gz" "$HOME/.local/bin/niri" \
                || warn "niri not available — install manually from https://github.com/YaLTeR/niri/releases"
        fi
        ;;
    fedora|rhel)
        pkg_install \
            plasma-desktop plasma-nm konsole dolphin kate spectacle \
            xorg-x11-server-Xwayland xdg-user-dirs \
            waybar wofi wl-clipboard \
            flameshot brightnessctl playerctl \
            alacritty kitty \
            pipewire pipewire-pulse wireplumber pavucontrol alsa-utils \
            vlc gstreamer1-plugins-bad-free gstreamer1-plugins-ugly \
            google-noto-fonts-common google-noto-emoji-fonts \
            jetbrains-mono-fonts papirus-icon-theme \
            firefox flatpak bluez
        pkg_try niri || warn "niri not in dnf — install via cargo or GitHub release"
        ;;
    opensuse)
        pkg_install \
            plasma-desktop plasma5-addon-networkmanagement konsole dolphin kate \
            xorg-x11-server-extra xdg-user-dirs \
            waybar wofi wl-clipboard \
            flameshot brightnessctl playerctl \
            alacritty \
            pipewire pipewire-pulse wireplumber pavucontrol alsa-utils \
            vlc papirus-icon-theme firefox flatpak bluez
        pkg_try niri || warn "niri not in zypper — install via cargo or GitHub release"
        ;;
    esac
    ok "Desktop packages done"
fi

# ── AUR packages (Arch only) ──────────────────────────────────────────────────
if $INSTALL_AUR && [[ "$DISTRO" == "arch" ]]; then
    step "Installing AUR packages"
    for pkg in matugen-bin nirinit postman-bin thorium-browser-bin; do
        $AUR_CMD -S --needed --noconfirm "$pkg" || warn "AUR: $pkg failed — skipping"
    done
    ok "AUR packages done"
fi

# ── Symlink helper ────────────────────────────────────────────────────────────
link() {
    local src="$1" dst="$2"
    if [[ -e "$dst" && ! -L "$dst" ]]; then
        mkdir -p "$(dirname "$BACKUP/$dst")"
        cp -r "$dst" "$BACKUP/$dst" 2>/dev/null || true
        warn "Backed up $(basename "$dst") → $BACKUP"
    fi
    mkdir -p "$(dirname "$dst")"
    ln -sf "$src" "$dst"
    ok "Linked $dst"
}

# ── Dotfiles symlinks ─────────────────────────────────────────────────────────
step "Linking dotfiles"

link "$DOTFILES/home/.tmux.conf"                              "$HOME/.tmux.conf"
link "$DOTFILES/home/.tmux/pentest.sh"                        "$HOME/.tmux/pentest.sh"
link "$DOTFILES/home/.tmux/session-manager.sh"                "$HOME/.tmux/session-manager.sh"
chmod +x "$HOME/.tmux/pentest.sh" "$HOME/.tmux/session-manager.sh"

link "$DOTFILES/config/fish/config.fish"                      "$HOME/.config/fish/config.fish"
link "$DOTFILES/config/fish/conf.d/00_init.fish"              "$HOME/.config/fish/conf.d/00_init.fish"
link "$DOTFILES/config/fish/conf.d/10-aliases.fish"           "$HOME/.config/fish/conf.d/10-aliases.fish"
link "$DOTFILES/config/fish/conf.d/20-customization.fish"     "$HOME/.config/fish/conf.d/20-customization.fish"
link "$DOTFILES/config/fish/conf.d/30-autostart.fish"         "$HOME/.config/fish/conf.d/30-autostart.fish"
link "$DOTFILES/config/fish/conf.d/40-abbreviations.fish"     "$HOME/.config/fish/conf.d/40-abbreviations.fish"
link "$DOTFILES/config/fish/functions/mkclient.fish"          "$HOME/.config/fish/functions/mkclient.fish"
link "$DOTFILES/config/fish/functions/vpn.fish"               "$HOME/.config/fish/functions/vpn.fish"
link "$DOTFILES/config/fish/functions/nmap.fish"              "$HOME/.config/fish/functions/nmap.fish"
link "$DOTFILES/config/fish/functions/gobuster.fish"          "$HOME/.config/fish/functions/gobuster.fish"
link "$DOTFILES/config/fish/functions/ffuf.fish"              "$HOME/.config/fish/functions/ffuf.fish"
link "$DOTFILES/config/fish/functions/ports.fish"             "$HOME/.config/fish/functions/ports.fish"
link "$DOTFILES/config/fish/functions/foreach.fish"           "$HOME/.config/fish/functions/foreach.fish"
link "$DOTFILES/config/fish/functions/pick.fish"              "$HOME/.config/fish/functions/pick.fish"
link "$DOTFILES/config/fish/functions/payload.fish"           "$HOME/.config/fish/functions/payload.fish"
link "$DOTFILES/config/fish/functions/test_wildcard_dns.fish" "$HOME/.config/fish/functions/test_wildcard_dns.fish"
link "$DOTFILES/config/fish/functions/__cd_fzf_tab.fish"      "$HOME/.config/fish/functions/__cd_fzf_tab.fish"
link "$DOTFILES/config/ohmyposh/zen.toml"                     "$HOME/.config/ohmyposh/zen.toml"
link "$DOTFILES/local/bin/nmap-color"                         "$HOME/.local/bin/nmap-color"
link "$DOTFILES/local/bin/gobuster-color"                     "$HOME/.local/bin/gobuster-color"
link "$DOTFILES/local/bin/ffuf-color"                         "$HOME/.local/bin/ffuf-color"
link "$DOTFILES/local/bin/payload-manager"                    "$HOME/.local/bin/payload-manager"
link "$DOTFILES/local/share/applications/payload-manager.desktop" "$HOME/.local/share/applications/payload-manager.desktop"
link "$DOTFILES/local/share/icons/hicolor/scalable/apps/payload-manager.svg" \
     "$HOME/.local/share/icons/hicolor/scalable/apps/payload-manager.svg"
chmod +x "$HOME/.local/bin/nmap-color" "$HOME/.local/bin/gobuster-color" "$HOME/.local/bin/ffuf-color" "$HOME/.local/bin/payload-manager"

ln -sf "$HOME/.tmux/pentest.sh" "$HOME/.local/bin/pentest"
chmod +x "$HOME/.local/bin/pentest"

# Obsidian Dracula theme (snippet only — vault path may differ per user)
OBSIDIAN_VAULT="${OBSIDIAN_VAULT:-$HOME/Documents/keving}"
if [ -d "$OBSIDIAN_VAULT/.obsidian" ]; then
    mkdir -p "$OBSIDIAN_VAULT/.obsidian/snippets"
    link "$DOTFILES/config/obsidian/snippets/dracula-pro.css" "$OBSIDIAN_VAULT/.obsidian/snippets/dracula-pro.css"
    link "$DOTFILES/config/obsidian/appearance.json"          "$OBSIDIAN_VAULT/.obsidian/appearance.json"
    ok "Obsidian Dracula theme linked"
else
    warn "Obsidian vault not found at $OBSIDIAN_VAULT — set OBSIDIAN_VAULT=/path/to/vault and re-run"
fi

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
if command -v fish &>/dev/null; then
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
else
    warn "fish not found — skipping shell change"
fi

# ── Tmux Plugin Manager ───────────────────────────────────────────────────────
step "Installing tmux plugins (TPM)"
if [[ ! -d "$HOME/.tmux/plugins/tpm" ]]; then
    git clone https://github.com/tmux-plugins/tpm "$HOME/.tmux/plugins/tpm"
    ok "TPM cloned"
else
    ok "TPM already present"
fi
if command -v tmux &>/dev/null; then
    "$HOME/.tmux/plugins/tpm/bin/install_plugins" 2>/dev/null \
        && ok "Tmux plugins installed" \
        || warn "Run Ctrl+S then I inside tmux to install plugins"
fi

# ── jsintel ───────────────────────────────────────────────────────────────────
step "Setting up jsintel"
JSINTEL_DST="$HOME/jsintel"
if [[ ! -d "$JSINTEL_DST" ]]; then
    cp -r "$DOTFILES/jsintel" "$JSINTEL_DST"
fi
chmod +x "$JSINTEL_DST/bin/jsintel.js"
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
(cd "$JSINTEL_DST" && npm link)
ok "jsintel linked — run: jsintel --help"

# ── Go tools ──────────────────────────────────────────────────────────────────
step "Installing Go tools"
export PATH="$PATH:$HOME/go/bin"
go_install "github.com/projectdiscovery/httpx/cmd/httpx@latest" "httpx"

# Add ~/go/bin to fish PATH if not already there
if ! grep -q 'go/bin' "$HOME/.config/fish/conf.d/00_init.fish" 2>/dev/null; then
    echo -e "\nfish_add_path \$HOME/go/bin" >> "$DOTFILES/config/fish/conf.d/00_init.fish"
fi

# ── Git config ────────────────────────────────────────────────────────────────
step "Git config"
current_name=$(git config --global user.name 2>/dev/null || true)
current_email=$(git config --global user.email 2>/dev/null || true)
if [[ -z "$current_name" ]]; then
    echo -n "  Git name (e.g. Galatron01): "; read -r git_name
    git config --global user.name "$git_name"
fi
if [[ -z "$current_email" ]]; then
    echo -n "  Git email: "; read -r git_email
    git config --global user.email "$git_email"
fi
ok "Git: $(git config --global user.name) <$(git config --global user.email)>"

# ── SecLists ──────────────────────────────────────────────────────────────────
step "Wordlists"
if [[ ! -d "$HOME/Documents/SecLists" ]]; then
    if ask "Clone SecLists to ~/Documents/SecLists? (~1GB)"; then
        git clone --depth 1 https://github.com/danielmiessler/SecLists.git "$HOME/Documents/SecLists"
        ok "SecLists cloned"
    else
        warn "Skipped — clone later: git clone https://github.com/danielmiessler/SecLists.git ~/Documents/SecLists"
    fi
else
    ok "SecLists already present"
fi

# ── Pentest directories ───────────────────────────────────────────────────────
mkdir -p "$HOME/Documents/Clients" "$HOME/Documents/lists"
ok "~/Documents/Clients ready"

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}══════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Done! Machine setup complete.${RESET}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${CYAN}Next steps:${RESET}"
echo -e "  1. Copy your VPN config:     ${YELLOW}cp profile.ovpn ~/.config/openvpn/client.conf${RESET}"
echo -e "  2. Start a new shell:        ${YELLOW}exec fish${RESET}"
echo -e "  3. Install tmux plugins:     ${YELLOW}open tmux → Ctrl+S then I${RESET}"
echo -e "  4. Test pentest launcher:    ${YELLOW}Ctrl+S then Ctrl+T${RESET}"
echo ""
