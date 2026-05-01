fish_add_path $HOME/.npm-global/bin

# fzf shell integration (ctrl+r history, ctrl+t files, alt+c cd)
fzf --fish | source

# Zoxide (smarter cd) — install with: sudo pacman -S zoxide
if command -q zoxide
    zoxide init fish | source
end


alias nmapfull='sudo nmap -sS -sU -V --min-rate=1000 -oN'
# Vi key bindings
fish_vi_key_bindings

# Cursor shape per mode: line in insert, block in normal, underline in replace
function fish_vi_cursor
    switch $fish_bind_mode
        case insert
            echo -en '\e[6 q'  # thin bar
        case default
            echo -en '\e[2 q'  # block
        case replace_one replace
            echo -en '\e[4 q'  # underline
        case visual
            echo -en '\e[2 q'  # block
    end
end
