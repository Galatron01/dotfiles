#!/usr/bin/env bash

sessions=$(tmux list-sessions -F "#{session_name}" 2>/dev/null)

output=$(echo "$sessions" | fzf \
    --prompt="  Session: " \
    --header="Select + Enter to switch | Ctrl-D to delete | Type new name + Enter to create" \
    --print-query \
    --no-sort \
    --height=100% \
    --border=rounded \
    --preview="tmux list-windows -F '  #{window_index}: #{window_name}' -t {} 2>/dev/null || echo '  (new session)'" \
    --preview-window=right:40% \
    --expect=ctrl-d 2>/dev/null)

# 0 = selected, 1 = no match (but query may still be valid), 130 = cancelled
fzf_exit=$?
[ $fzf_exit -eq 130 ] && exit 0
[ $fzf_exit -eq 2 ] && exit 0

query=$(printf '%s' "$output" | sed -n '1p')
key=$(printf '%s' "$output" | sed -n '2p')
selection=$(printf '%s' "$output" | sed -n '3p')

if [ "$key" = "ctrl-d" ]; then
    target="${selection:-$query}"
    [ -z "$target" ] && exit 0
    # Switch away first if we're deleting the current session
    current=$(tmux display-message -p '#S')
    if [ "$target" = "$current" ]; then
        other=$(tmux list-sessions -F "#{session_name}" | grep -v "^${target}$" | head -1)
        if [ -n "$other" ]; then
            tmux switch-client -t "$other"
        fi
    fi
    tmux kill-session -t "$target" 2>/dev/null
    exit 0
fi

if [ -n "$selection" ] && tmux has-session -t "$selection" 2>/dev/null; then
    tmux switch-client -t "$selection"
elif [ -n "$query" ]; then
    tmux new-session -d -s "$query" -n "shell"
    tmux new-window -t "$query" -n "editor"
    tmux new-window -t "$query" -n "git"
    tmux select-window -t "${query}:1"
    tmux switch-client -t "$query"
    ~/.tmux/plugins/tmux-resurrect/scripts/save.sh quiet 2>/dev/null &
fi
