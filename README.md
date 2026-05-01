# dotfiles

Pentest workstation setup — fish shell, tmux, neovim, oh-my-posh, colour-coded security tools, and a one-command pentest session launcher.

---

## Fresh Machine Setup

### 1. Clone the repo

**Option A — HTTPS (easiest, no SSH key needed):**
```bash
git clone https://github.com/Galatron01/dotfiles.git ~/dotfiles
cd ~/dotfiles
```
When prompted: username = `Galatron01`, password = your GitHub Personal Access Token (not your account password).

To get a token: github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → tick **repo** → copy it → paste as password.

---

**Option B — SSH:**

Run this on the new machine first:
```bash
ssh-keygen -t ed25519 -C "kevin@stargazerdigital.co.uk" -f ~/.ssh/id_ed25519 -N ""
ssh-keyscan github.com >> ~/.ssh/known_hosts
cat ~/.ssh/id_ed25519.pub
```
Copy the output → github.com → Settings → SSH and GPG keys → New SSH key → paste → save.

Then clone:
```bash
git clone git@github.com:Galatron01/dotfiles.git ~/dotfiles
cd ~/dotfiles
```

### 2. Run the installer
```bash
./install.sh
```

The script detects your distro automatically and uses the right package manager:

| Distro | Package manager |
|---|---|
| Arch / CachyOS / Manjaro | pacman + paru (AUR) |
| Debian / Ubuntu / Kali | apt |
| Fedora / RHEL / CentOS | dnf |
| openSUSE | zypper |

It will ask which modules you want:

| Module | What it installs |
|---|---|
| Core (always) | fish, tmux, neovim, fzf, zoxide, bat, eza, ripgrep, go, python, nodejs |
| Pentest tools | nmap, ffuf, gobuster, feroxbuster, sslscan, sslyze, testssl.sh |
| Desktop | KDE Plasma, Niri, waybar, alacritty, kitty, fonts, browsers |
| AUR (Arch only) | postman, thorium, matugen, nirinit |

Tools not available in a distro's repos (ffuf, gobuster, feroxbuster on non-Arch) are installed via Go automatically.

Then it automatically:
- Symlinks all configs to the right places
- Installs oh-my-posh
- Sets fish as your default shell
- Installs tmux plugins (TPM)
- Sets up jsintel globally
- Installs httpx via Go
- Prompts for git name/email
- Offers to clone SecLists

### 3. Copy your VPN config manually
```bash
# VPN config contains credentials — keep it out of git
cp /path/to/profile.ovpn ~/.config/openvpn/client.conf
```

### 4. Start a new shell
```bash
exec fish
```

### 5. Install tmux plugins
Open tmux, then press `Ctrl+S` then `I` (capital i).

---

## What's Included

### tmux
- Prefix: `Ctrl+S`
- Session manager popup: `Ctrl+S` then `Ctrl+P`
- Pentest session launcher: `Ctrl+S` then `Ctrl+T`
- Split horizontal: `Ctrl+S q` | Split vertical: `Ctrl+S e`
- Auto-save every 5 min, auto-restore on start (tmux-continuum)

### Pentest Session Launcher (`Ctrl+S` `Ctrl+T`)
Prompts for client name and scope, then spins up a structured tmux session:

| Window | Purpose |
|---|---|
| nmap | nmap scans |
| ssl | sslscan, testssl.sh |
| dir enum | ffuf, gobuster, feroxbuster |
| js | notes.md + JS review |
| reco | httpx, amass, subfinder |

Creates `~/Documents/Clients/<client>/found/{nmap,httpx,ssl,dirs}` and sources a fish env with `$SCOPE`, `$WORKDIR`, `sweep`, `foreach {}`, and `pick {}` into every pane.

### Fish Shell
- Vi key bindings, fzf integration (Ctrl+R history, Ctrl+T files)
- zoxide (`z` for smart directory jumping)
- oh-my-posh prompt with git status and tun0 IP in right prompt
- Custom functions: `ports`, `vpn on/off/status`, `mkclient`, colourised `nmap`/`gobuster`/`ffuf`

### Colour Scripts (`~/.local/bin/`)
Dracula-themed output wrappers for nmap, gobuster, and ffuf — automatically used when running those commands in a terminal.

### jsintel
JavaScript intelligence tool for pentest recon — detects outdated libraries, vulnerable comments, and dangerous code patterns.
```bash
jsintel -u example.com               # crawl and scan
jsintel -u example.com -c "k=v"     # with cookies
jsintel src/                          # scan local folder
```

---

## Updating an Existing Machine

Pull latest changes and re-run the linker:
```bash
cd ~/dotfiles
git pull
./install.sh
```
Existing symlinks are skipped — only new files get linked.

---

## File Structure

```
dotfiles/
├── install.sh              — bootstrap script
├── packages-core.txt       — core CLI packages
├── packages-pentest.txt    — pentest tools
├── packages-desktop.txt    — KDE + Hyprland desktop
├── packages-aur.txt        — AUR packages
├── home/
│   ├── .tmux.conf          — tmux config
│   └── .tmux/
│       ├── pentest.sh      — pentest session launcher
│       └── session-manager.sh
├── config/
│   ├── fish/
│   │   ├── config.fish
│   │   ├── conf.d/         — init, aliases, prompt, abbreviations
│   │   └── functions/      — ports, vpn, mkclient, nmap, gobuster, ffuf
│   └── ohmyposh/
│       └── zen.toml        — prompt theme
├── local/bin/
│   ├── nmap-color          — colour-coded nmap output
│   ├── gobuster-color      — colour-coded gobuster output
│   └── ffuf-color          — colour-coded ffuf output
└── jsintel/                — JS intelligence tool
    └── bin/jsintel.js
```
