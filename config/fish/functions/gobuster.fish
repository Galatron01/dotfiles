function gobuster --description 'gobuster with Dracula colour-coded output'
    if test -t 1
        command gobuster $argv | python3 ~/.local/bin/gobuster-color
    else
        command gobuster $argv
    end
end
