$apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlbW9rdXF6ZHVya2tna3lzZWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NTE5MzYsImV4cCI6MjA3MzEyNzkzNn0.E2tIo372vZJfN_8Gv-pZTo1-XyQRq_ZDneStO9oKMDA"
$baseUrl = "https://gemokuqzdurkkgkyseix.supabase.co/rest/v1/floods"
$headers = @{ "apikey" = $apiKey }

# Fetch all event names
$allRecords = @()
$offset = 0
$batchSize = 1000

do {
    $url = "$baseUrl`?select=flood_event_name&flood_event_name=not.is.null&flood_event_name=not.eq.&offset=$offset&limit=$batchSize"
    $batch = Invoke-RestMethod -Uri $url -Headers $headers
    $allRecords += $batch
    $offset += $batchSize
} while ($batch.Count -eq $batchSize)

# JavaScript Set is case-sensitive
$names = $allRecords | ForEach-Object { $_.flood_event_name.Trim() } | Where-Object { $_ -ne "" }

# Case-sensitive unique (like JavaScript Set)
$caseSensitiveUnique = @{}
foreach ($name in $names) {
    if (-not $caseSensitiveUnique.ContainsKey($name)) {
        $caseSensitiveUnique[$name] = $true
    }
}
Write-Host "Case-sensitive unique (like JS Set): $($caseSensitiveUnique.Count)"

# PowerShell default (case-insensitive on Windows)
$caseInsensitiveUnique = $names | Sort-Object -Unique
Write-Host "Case-insensitive unique (PS default): $($caseInsensitiveUnique.Count)"
