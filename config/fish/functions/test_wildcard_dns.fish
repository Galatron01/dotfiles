function test_wildcard_dns
    printf "\e[34m----[Base Domain]----\e[0m\n"
    dig +noall +answer -t A $argv[1]

    printf "\n\e[34m----[First Layer Subdomains]----\e[0m\n"
    dig +noall +answer -t A abc.$argv[1]
    dig +noall +answer -t A xyz.$argv[1]

    printf "\n\e[34m----[Third Layer Subdomains]----\e[0m\n"
    for i in (seq 5)
        set RNG (cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 6 | head -n 1)
        dig +noall +answer -t A $RNG.random.$argv[1]
    end
end
