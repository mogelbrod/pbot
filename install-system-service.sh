#!/bin/bash -e

SERVICE=pbot.service
SERVICE_DIR="$HOME/.config/systemd/user"

if [ -d "$SERVICE_DIR" ]; then
  echo "==== Service definition exists"
else
  echo "==== Creating $SERVICE_DIR"
  mkdir -p "$SERVICE_DIR"
fi

echo "==== Create service definition"
sed -e "s#{root}#$(pwd)#g" > "$SERVICE_DIR/$SERVICE" <<EOF
[Unit]
Description=Powerbaers slack bot
After=network.target
After=network-online.target
AssertPathExists={root}

[Service]
Restart=always
RestartSec=10
WorkingDirectory={root}
ExecStart=/usr/bin/env npm run service

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
