#!/bin/bash -e

SERVICE=pbot.service

echo "==== Create service definition"
sed -e "s#{root}#$(pwd)#g" > ~/.config/systemd/user/$SERVICE <<EOF
[Unit]
Description=Powerbaers slack bot
After=network.target
After=network-online.target
AssertPathExists={root}

[Service]
Restart=always
RestartSec=10
WorkingDirectory={root}
ExecStart=/usr/bin/env node {root}/index.js bot

[Install]
WantedBy=default.target
EOF

echo "==== Allow services to stay active even after user have ended all active login sessions"
loginctl enable-linger $(whoami)

echo "==== Configure service to run on boot"
systemctl --user enable $SERVICE

echo "==== Start service"
systemctl --user start $SERVICE

echo "==== Verify that service is running"
systemctl --user status $SERVICE
