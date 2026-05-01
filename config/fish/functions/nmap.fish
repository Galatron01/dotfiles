function nmap --description 'nmap with Dracula colour-coded output'
    if test -t 1
        python3 ~/.local/bin/nmap-color $argv
    else
        command nmap $argv
    end
end
