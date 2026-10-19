$ErrorActionPreference = 'Stop'
$taskName = 'Mji Local Combo AI - Weekly'
$weeklyScript = Join-Path $PSScriptRoot 'Run-Weekly.ps1'
$taskArgs = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $weeklyScript + '"'
$taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArgs
$taskTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -WeeksInterval 1 -At '09:00'
$taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Days 2)
$taskUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $taskUser -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Principal $taskPrincipal -Description 'Local-only creator combo extraction. Saves candidates for human review; no Codex inference or automatic publication.' -Force | Out-Null
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object NextRunTime,LastTaskResult
Write-Host 'Installed: Mondays at 09:00 local time. Computer must be on, plugged in, and your Windows account signed in. No Codex app is required.'
