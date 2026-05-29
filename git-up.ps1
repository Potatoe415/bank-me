param (
    [string]$Message
)

# Récupération dynamique de la branche (remontée pour pouvoir l'utiliser dans le message)
$CurrentBranch = git branch --show-current
if (-not $CurrentBranch) {
    Write-Error "Erreur : Impossible de déterminer la branche Git courante."
    exit 1
}

# Injection du message par défaut
if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "chore: commit automatique sur $CurrentBranch - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    #Write-Host "Avertissement : Aucun message fourni. Utilisation du message par défaut : '$Message'" -ForegroundColor Yellow
}

# Bloquer l'exécution s'il n'y a rien à commiter
$UncommittedChanges = git status --porcelain
if (-not $UncommittedChanges) {
    Write-Host "Aucun changement à commiter. Arrêt du script."
    exit 0
}

Write-Host "--- git add ."
git add .

Write-Host "--- git commit"
git commit -m "$Message"
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Échec du commit Git."
    exit $LASTEXITCODE 
}

Write-Host "--- git push ($CurrentBranch)"
git push -u origin $CurrentBranch
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Échec du push Git."
    exit $LASTEXITCODE 
}

Write-Host "--- supabase db push"
npx supabase db push
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Échec de la synchronisation Supabase."
    exit $LASTEXITCODE 
}