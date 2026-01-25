$apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlbW9rdXF6ZHVya2tna3lzZWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NTE5MzYsImV4cCI6MjA3MzEyNzkzNn0.E2tIo372vZJfN_8Gv-pZTo1-XyQRq_ZDneStO9oKMDA"
$baseUrl = "https://gemokuqzdurkkgkyseix.supabase.co/rest/v1/floods"
$headers = @{ "apikey" = $apiKey }

# Fetch all records in batches
$allNames = @()
$offset = 0
$batchSize = 1000

do {
    $url = "$baseUrl`?select=flood_event_name&offset=$offset&limit=$batchSize"
    $batch = Invoke-RestMethod -Uri $url -Headers $headers
    $allNames += $batch
    Write-Host "Fetched batch at offset $offset - got $($batch.Count) records"
    $offset += $batchSize
} while ($batch.Count -eq $batchSize)

Write-Host ""
Write-Host "Total records fetched: $($allNames.Count)"

# Extract and count unique names
$uniqueNames = $allNames | ForEach-Object { $_.flood_event_name } | Where-Object { $_ -ne $null -and $_ -ne "" } | Sort-Object -Unique
Write-Host "Unique non-empty event names: $($uniqueNames.Count)"

# Count null and empty
$nullCount = ($allNames | Where-Object { $_.flood_event_name -eq $null }).Count
$emptyCount = ($allNames | Where-Object { $_.flood_event_name -eq "" }).Count
Write-Host "Null event names: $nullCount"
Write-Host "Empty event names: $emptyCount"
