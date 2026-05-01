function vpn --description 'Control OpenVPN (on / off / status)'
    set service openvpn-client@client

    switch $argv[1]
        case on start
            echo "Starting VPN..."
            sudo systemctl start $service
            if test $status -eq 0
                echo "VPN is ON"
            else
                echo "Failed to start VPN — check: systemctl status $service"
            end

        case off stop
            echo "Stopping VPN..."
            sudo systemctl stop $service
            if test $status -eq 0
                echo "VPN is OFF"
            else
                echo "Failed to stop VPN — check: systemctl status $service"
            end

        case status ''
            set state (systemctl is-active $service 2>/dev/null)
            if test "$state" = active
                echo "VPN is ON  (openvpn-client@client running)"
            else
                echo "VPN is OFF  (state: $state)"
            end

        case '*'
            echo "Usage: vpn on | vpn off | vpn status"
            return 1
    end
end
