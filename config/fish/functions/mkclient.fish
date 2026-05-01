function mkclient --description 'Create a client folder with found/notfound subfolders'
    if test -z "$argv[1]"
        echo "Usage: mkclient <client-name>"
        return 1
    end

    set client_dir "$HOME/Documents/Clients/$argv[1]"

    if test -d "$client_dir"
        echo "Client folder already exists: $client_dir"
        return 1
    end

    mkdir -p "$client_dir/found" "$client_dir/notfound"
    echo "Created: $client_dir"
    echo "         ├── found"
    echo "         └── notfound"
end
