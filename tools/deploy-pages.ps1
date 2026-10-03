# Publishes the web/ folder to the "gh-pages" branch of this repo's GitHub remote, which GitHub Pages serves.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File tools\deploy-pages.ps1
# Needs: git, node, and a GitHub remote named "origin" (see docs/HUMAN-STEPS.md, section S2).
# It never touches your working branch: it copies web/ to a temp folder, makes a one-commit repo there,
# and force-pushes it to gh-pages. The dev-only folder web/dev is left out.
param([string]$Remote = 'origin', [string]$Branch = 'gh-pages')
$ErrorActionPreference = 'Stop'

$repo = (git -C $PSScriptRoot rev-parse --show-toplevel).Trim()
$web = Join-Path $repo 'web'
if (-not (Test-Path (Join-Path $web 'index.html'))) { throw "web/index.html not found under $repo" }
$url = (git -C $repo remote get-url $Remote).Trim()
if (-not $url) { throw "No git remote named '$Remote'. Add it first (docs/HUMAN-STEPS.md)." }

Write-Host 'Listing view files...'
node (Join-Path $web 'dev\gen-views.mjs')
if ($LASTEXITCODE -ne 0) { throw 'gen-views failed' }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ('hb-pages-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  # robocopy exit codes 0-7 mean success
  robocopy $web $tmp /E /XD dev /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
  New-Item -ItemType File -Path (Join-Path $tmp '.nojekyll') -Force | Out-Null   # serve files as they are

  git -C $tmp init -q -b $Branch
  git -C $tmp add -A
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
  git -C $tmp -c user.name='House Bible deploy' -c user.email='deploy@localhost' commit -q -m "Deploy $stamp"
  Write-Host "Pushing to $url ($Branch)..."
  git -C $tmp push --force $url "${Branch}:${Branch}"
  if ($LASTEXITCODE -ne 0) { throw 'git push failed. Check you are signed in to GitHub (a browser window may have opened).' }
  Write-Host 'Done. GitHub takes about a minute to update the site.'
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
