function __cd_fzf_tab
    set cmd (commandline)

    if string match -qr '^cd(\s|$)' $cmd
        set query (string replace -r '^cd\s*' '' $cmd)
        set dir (find . -type d -not -path '*/\.*' 2>/dev/null | fzf \
            --query="$query" \
            --prompt="  cd: " \
            --preview='ls -la {}' \
            --preview-window=right:50% \
            --border=rounded \
            --height=80%)
        if test -n "$dir"
            commandline "cd $dir"
            commandline -f execute
        end
    else
        commandline -f complete
    end
end
