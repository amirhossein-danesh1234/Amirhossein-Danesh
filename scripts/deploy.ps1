param([string]$SshAlias = 'amirhossein-danesh')
$ErrorActionPreference = 'Stop'
function Assert-Exit([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE)" }
}
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$dirty = git status --porcelain
Assert-Exit 'Git status'
if ($dirty) { throw 'Commit and push the intended working version before deploying.' }
$revision = git rev-parse HEAD
Assert-Exit 'Git revision'
$remote = git ls-remote origin refs/heads/main
Assert-Exit 'Remote revision'
if (($remote -split '\s+')[0] -ne $revision) { throw 'Local HEAD differs from GitHub main.' }
npm run build
Assert-Exit 'Build'
Set-Content -LiteralPath (Join-Path $root 'dist/REVISION') -Value $revision -Encoding ascii
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $env:TEMP "amirhossein-danesh-$stamp.tar.gz"
tar -czf $archive -C (Join-Path $root 'dist') .
Assert-Exit 'Archive'
scp $archive "${SshAlias}:/tmp/"
Assert-Exit 'Upload'
$remoteArchive = "/tmp/$(Split-Path $archive -Leaf)"
$releasePath = "/var/www/amirhossein-danesh.ir/releases/$stamp"
$remoteCommand = "set -eu; mkdir -p '$releasePath'; tar -xzf '$remoteArchive' -C '$releasePath'; chmod -R a+rX '$releasePath'; test -f '$releasePath/index.html'; ln -s '$releasePath' /var/www/amirhossein-danesh.ir/current.next; mv -Tf /var/www/amirhossein-danesh.ir/current.next /var/www/amirhossein-danesh.ir/current; rm -f '$remoteArchive'; curl -fsSI -H 'Host: amirhossein-danesh.ir' http://127.0.0.1/"
ssh $SshAlias $remoteCommand
Assert-Exit 'Release activation'
Remove-Item -LiteralPath $archive -Force
