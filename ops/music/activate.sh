#!/usr/bin/env bash
set -euo pipefail

release=$1
archive=$2
site=/var/www/amirhossein-danesh.ir
service=/etc/systemd/system/hamnava.service
vhost=/etc/nginx/sites-available/hamnava
enabled=/etc/nginx/sites-enabled/hamnava
previous=$(readlink "$site/current")
backup=$(mktemp -d)
test -s /etc/hamnava/production.env
test -s "$release/dist/index.html"
test -s "$release/dist/music/index.html"
test ! -e "$site/current.next"
if [[ -e $service ]]; then cp -p "$service" "$backup/service"; fi
if [[ -e $vhost ]]; then cp -p "$vhost" "$backup/vhost"; fi
was_enabled=false
if [[ -L $enabled ]]; then was_enabled=true; fi
switched=false

rollback() {
  local status=$?
  set +e
  if (( status != 0 )); then
    if $switched; then
      ln -s "$previous" "$site/current.next"
      mv -Tf "$site/current.next" "$site/current"
    fi
    if [[ -f $backup/service ]]; then
      cp -p "$backup/service" "$service"
      systemctl daemon-reload
      systemctl restart hamnava.service
    else
      systemctl disable --now hamnava.service
      rm -f "$service"
      systemctl daemon-reload
    fi
    if ! $was_enabled; then rm -f "$enabled"; fi
    if [[ -f $backup/vhost ]]; then cp -p "$backup/vhost" "$vhost"; else rm -f "$vhost"; fi
    nginx -t && systemctl reload nginx
  fi
  rm -f "$backup/service" "$backup/vhost"
  rmdir "$backup"
  exit "$status"
}
trap rollback EXIT

install -m 644 "$release/ops/music/hamnava.service" "$service"
install -m 644 "$release/ops/music/hamnava.nginx.conf" "$vhost"
if ! $was_enabled; then ln -s "$vhost" "$enabled"; fi
nginx -t
ln -s "$release/dist" "$site/current.next"
mv -Tf "$site/current.next" "$site/current"
switched=true
systemctl daemon-reload
systemctl enable hamnava.service
systemctl restart hamnava.service
curl -fsS --retry 5 --retry-connrefused http://127.0.0.1:3102/api/pieces >/dev/null
systemctl reload nginx

check_origin() {
  local host=$1 path=$2
  echo "Checking $host$path on the origin"
  curl -fsS --max-time 5 --retry 4 --retry-delay 1 --retry-all-errors --resolve "$host:80:127.0.0.1" "http://$host$path" >/dev/null
}

check_origin amirhossein-danesh.ir /
check_origin music.amirhossein-danesh.ir /
check_origin music.amirhossein-danesh.ir /api/pieces
cat "$site/current/REVISION"
rm -f "$archive"
