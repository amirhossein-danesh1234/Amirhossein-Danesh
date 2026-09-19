$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
npm run build
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $env:TEMP "amirhossein-danesh-$stamp.tar.gz"
tar -czf $archive -C (Join-Path $root 'dist') .
scp $archive VPN:/tmp/
$remoteArchive = "/tmp/$(Split-Path $archive -Leaf)"
$remoteCommand = "set -eu; base=/var/www/amirhossein-danesh.ir; release=``$base/releases/$stamp; mkdir -p ``$release; tar -xzf '$remoteArchive' -C ``$release; ln -sfn ``$release ``$base/current; rm -f '$remoteArchive'; curl -fsSI -H 'Host: amirhossein-danesh.ir' http://127.0.0.1/ | head -1"
ssh VPN $remoteCommand
Remove-Item -LiteralPath $archive -Force
