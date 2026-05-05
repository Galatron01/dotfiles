function payload --description "Fuzzy search CopyQ payload tabs and copy selection to clipboard"
    set -l entries
    set -l tabs (copyq tab 2>/dev/null | grep -v '^&clipboard$')

    for tab in $tabs
        set -l count (copyq tab "$tab" count 2>/dev/null)
        test -z "$count"; or test "$count" = "0"; and continue
        for i in (seq 0 (math $count - 1))
            set -l item (copyq tab "$tab" read $i 2>/dev/null)
            test -z "$item"; and continue
            set -l display (string replace -a \n " " -- $item)
            # Format: [tab name]  payload — tab name is searchable prefix
            set -a entries "[$tab]  $display"
        end
    end

    if test (count $entries) -eq 0
        echo "No payload items found."
        return 1
    end

    set -l selection (printf '%s\n' $entries | fzf \
        --prompt='payload> ' \
        --height=40% \
        --layout=reverse \
        --color='hl:yellow,hl+:yellow')

    test -z "$selection"; and return 0

    # Extract tab name from [tab name] prefix
    set -l tab_name (string replace -r '^\[([^\]]+)\].*' '$1' -- $selection)
    # Extract display payload (after "]  ")
    set -l display_payload (string replace -r '^\[[^\]]+\]  ' '' -- $selection)

    # Re-fetch original item from CopyQ to preserve real newlines
    set -l count (copyq tab "$tab_name" count 2>/dev/null)
    for i in (seq 0 (math $count - 1))
        set -l item (copyq tab "$tab_name" read $i 2>/dev/null)
        set -l display (string replace -a \n " " -- $item)
        if test "$display" = "$display_payload"
            printf '%s' $item | wl-copy
            echo "[$tab_name] copied"
            return 0
        end
    end

    # Fallback
    printf '%s' $display_payload | wl-copy
    echo "[$tab_name] copied"
end
