#!/usr/bin/env fish
function ports --description 'Show listening ports, colour-coded by protocol and privilege'

    set -l RESET  '\033[0m'
    set -l BOLD   '\033[1m'
    set -l GREEN  '\033[38;2;80;250;123m'
    set -l ORANGE '\033[38;2;255;184;108m'
    set -l CYAN   '\033[38;2;139;233;253m'
    set -l PURPLE '\033[38;2;189;147;249m'
    set -l PINK   '\033[38;2;255;121;198m'
    set -l GRAY   '\033[38;2;98;114;164m'
    set -l YELLOW '\033[38;2;241;250;140m'

    echo -e "$BOLD{$PINK} TCP$RESET"
    echo -e "$GRAY$(printf '%-7s %-26s %-26s %s' Proto 'Local Address' 'Peer Address' Process)$RESET"

    ss -tlnp 2>/dev/null | tail -n +2 | while read -l line
        set -l cols (string split -n ' ' -- $line)
        set -l proto $cols[1]
        set -l local $cols[4]
        set -l peer  $cols[5]
        set -l proc  (string join ' ' $cols[6..])

        set -l port (string split ':' -- $local)[-1]
        set -l portcol $CYAN
        if test "$port" -lt 1024 2>/dev/null
            set portcol $YELLOW
        end

        echo -e "$GREEN$proto$RESET  $portcol$(printf '%-26s' $local)$RESET $GRAY$(printf '%-26s' $peer)$RESET $PURPLE$proc$RESET"
    end

    echo
    echo -e "$BOLD{$ORANGE} UDP$RESET"
    echo -e "$GRAY$(printf '%-7s %-26s %-26s %s' Proto 'Local Address' 'Peer Address' Process)$RESET"

    ss -ulnp 2>/dev/null | tail -n +2 | while read -l line
        set -l cols (string split -n ' ' -- $line)
        set -l proto $cols[1]
        set -l local $cols[4]
        set -l peer  $cols[5]
        set -l proc  (string join ' ' $cols[6..])

        set -l port (string split ':' -- $local)[-1]
        set -l portcol $CYAN
        if test "$port" -lt 1024 2>/dev/null
            set portcol $YELLOW
        end

        echo -e "$ORANGE$proto$RESET  $portcol$(printf '%-26s' $local)$RESET $GRAY$(printf '%-26s' $peer)$RESET $PURPLE$proc$RESET"
    end
end
