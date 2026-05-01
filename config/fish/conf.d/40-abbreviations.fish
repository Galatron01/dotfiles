# -----------------------------------------------------
# ABBREVIATIONS (expand in-place so you see the full command)
# -----------------------------------------------------

# --- Nmap ---
abbr ns   'nmap -sV -sC'
abbr nss  'nmap -sS -sV -sC'
abbr nall 'nmap -sS -sV -sC -p-'
abbr nu   'nmap -sU --top-ports 200'
abbr nping 'nmap -sn'

# --- Gobuster ---
abbr gbd  'gobuster dir -u'
abbr gbdns 'gobuster dns -d'
abbr gbvhost 'gobuster vhost -u'

# --- ffuf ---
abbr ffd  'ffuf -u'
abbr fffw 'ffuf -w /usr/share/wordlists/dirb/common.txt -u'

# --- Git ---
abbr gd   'git diff'
abbr gl   'git log --oneline --graph --decorate'
abbr grb  'git rebase'
abbr gco  'git checkout'
abbr gcb  'git checkout -b'
abbr gclean 'git clean -fd'

# --- Kitty ---
abbr icat 'kitten icat'
abbr kssh 'kitten ssh'
abbr kdiff 'kitten diff'
