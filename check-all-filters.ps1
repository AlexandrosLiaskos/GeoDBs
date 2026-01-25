$apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlbW9rdXF6ZHVya2tna3lzZWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NTE5MzYsImV4cCI6MjA3MzEyNzkzNn0.E2tIo372vZJfN_8Gv-pZTo1-XyQRq_ZDneStO9oKMDA"
$baseUrl = "https://gemokuqzdurkkgkyseix.supabase.co/rest/v1/floods"
$headers = @{ "apikey" = $apiKey }

# Count all unique values for each filter
$allRecords = @()
$offset = 0
$batchSize = 1000

do {
    $url = "$baseUrl`?select=year,location_name,deaths_toll_int,flood_event_name,cause_of_flood&offset=$offset&limit=$batchSize"
    $batch = Invoke-RestMethod -Uri $url -Headers $headers
    $allRecords += $batch
    $offset += $batchSize
} while ($batch.Count -eq $batchSize)

Write-Host "Total records: $($allRecords.Count)"
Write-Host ""

# Years
$years = @{}
foreach ($r in $allRecords) { if ($r.year) { $years[$r.year] = $true } }
Write-Host "Unique years: $($years.Count)"

# Locations  
$locations = @{}
foreach ($r in $allRecords) { if ($r.location_name -and $r.location_name.Trim() -ne "") { $locations[$r.location_name.Trim()] = $true } }
Write-Host "Unique locations: $($locations.Count)"

# Deaths toll
$deathsToll = @{}
foreach ($r in $allRecords) { if ($null -ne $r.deaths_toll_int) { $deathsToll[$r.deaths_toll_int] = $true } }
Write-Host "Unique deaths_toll_int: $($deathsToll.Count)"

# Event names
$eventNames = @{}
foreach ($r in $allRecords) { if ($r.flood_event_name -and $r.flood_event_name.Trim() -ne "") { $eventNames[$r.flood_event_name.Trim()] = $true } }
Write-Host "Unique event names: $($eventNames.Count)"

# Cause of flood
$causes = @{}
foreach ($r in $allRecords) { if ($r.cause_of_flood -and $r.cause_of_flood.Trim() -ne "") { $causes[$r.cause_of_flood.Trim()] = $true } }
Write-Host "Unique causes: $($causes.Count)"
