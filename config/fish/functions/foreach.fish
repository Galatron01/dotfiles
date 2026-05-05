function foreach
    if not set -q SCOPE
        echo "[!] \$SCOPE not set — source your .env.fish first"
        return 1
    end
    set pattern (string join -- ' ' $argv)
    for target in (cat $SCOPE | grep -v '^#' | grep -v '^[[:space:]]*$')
        set cmd (string replace -- 'TARGET' $target $pattern)
        echo "[>] $cmd"
        fish -c $cmd
    end
end
