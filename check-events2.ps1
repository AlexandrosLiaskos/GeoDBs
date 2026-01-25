$apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlbW9rdXF6ZHVya2tna3lzZWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NTE5MzYsImV4cCI6MjA3MzEyNzkzNn0.E2tIo372vZJfN_8Gv-pZTo1-XyQRq_ZDneStO9oKMDA"
$baseUrl = "https://gemokuqzdurkkgkyseix.supabase.co/rest/v1/floods"
$headers = @{ "apikey" = $apiKey }

# Fetch event names with NOT null and NOT empty (matching app query)
$allNames = @()
$offset = 0
$batchSize = 1000

do {
    $url = "$baseUrl`?select=flood_event_name&flood_event_name=not.is.null&flood_event_name=not.eq.&offset=$offset&limit=$batchSize"
    $batch = Invoke-RestMethod -Uri $url -Headers $headers
    $allNames += $batch
    Write-Host "Batch at offset $offset - $($batch.Count) records"
    $offset += $batchSize
} while ($batch.Count -eq $batchSize)

Write-Host ""
Write-Host "Total records with non-null, non-empty event names: $($allNames.Count)"

# Extract unique
$names = $allNames | ForEach-Object { $_.flood_event_name }
$uniqueNames = $names | Sort-Object -Unique
Write-Host "Unique event names: $($uniqueNames.Count)"

# Check for whitespace-only or odd characters
$trimmedUnique = $names | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" } | Sort-Object -Unique
Write-Host "Unique event names (trimmed): $($trimmedUnique.Count)"
