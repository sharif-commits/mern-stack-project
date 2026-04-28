#!/usr/bin/env pwsh

# Redate commits from March-April 2026
$env:FILTER_BRANCH_SQUELCH_WARNING = 1

# Define commit hashes and dates
$commits = @(
    @{ hash = '4513d387d818c738b0e97e8dfa95def40469f550'; date = '2026-03-15 10:00:00 +0530' },
    @{ hash = '4d6797c1f7f8cb9ae6f6036b0e66851bb0627f98'; date = '2026-04-15 14:30:00 +0530' }
)

# Build the filter-branch environment filter
$filter = 'if ($false) { } # placeholder'
foreach ($commit in $commits) {
    $hash = $commit.hash
    $date = $commit.date
    $filter += "`nif (`$env:GIT_COMMIT -eq '$hash') { `$env:GIT_AUTHOR_DATE = '$date'; `$env:GIT_COMMITTER_DATE = '$date' }"
}

# Create the filter script
$filterScript = @"
`$commits = @(
    @{ hash = '4513d387d818c738b0e97e8dfa95def40469f550'; date = '2026-03-15 10:00:00 +0530' },
    @{ hash = '4d6797c1f7f8cb9ae6f6036b0e66851bb0627f98'; date = '2026-04-15 14:30:00 +0530' }
)

foreach (`$commit in `$commits) {
    if (`$env:GIT_COMMIT -eq `$commit.hash) {
        `$env:GIT_AUTHOR_DATE = `$commit.date
        `$env:GIT_COMMITTER_DATE = `$commit.date
    }
}
"@

Write-Host "Redating commits from March-April 2026..."
Write-Host "Commit 1: 4513d387... -> 2026-03-15"
Write-Host "Commit 2: 4d6797c1... -> 2026-04-15"

# Run filter-branch
& git filter-branch --env-filter $filterScript --tag-name-filter cat -- --all

Write-Host "Done! Commits have been backdated."
Write-Host "Current commits:"
& git log --pretty=format:"%h %s %ai" --all
