function ffuf --description 'ffuf with Dracula colour-coded output'
    if test -t 1
        command ffuf $argv | python3 ~/.local/bin/ffuf-color
    else
        command ffuf $argv
    end
end
