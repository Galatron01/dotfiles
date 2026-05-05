function pick
    if not set -q SCOPE
        echo "[!] \$SCOPE not set — source your .env.fish first"
        return 1
    end
    set pattern (string join -- ' ' $argv)
    set selected (cat $SCOPE | grep -v '^#' | grep -v '^[[:space:]]*$' | fzf \
        --multi \
        --prompt="  Targets: " \
        --header="Tab = select/deselect  |  Enter = run  |  Esc = cancel" \
        --border=rounded \
        --height=80%)
    if test -z "$selected"
        echo "[!] No targets selected"
        return
    end
    for target in $selected
        set cmd (string replace -- 'TARGET' $target $pattern)
        echo "[>] $cmd"
        fish -c $cmd
    end
end
