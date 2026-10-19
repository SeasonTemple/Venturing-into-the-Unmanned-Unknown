#Requires -Version 7.3
<#
.SYNOPSIS
  设置 GitHub 仓库 About（Description、Homepage 与 Topics），并回读核对。
.PARAMETER Repo
  可选，OWNER/REPO。省略时使用当前仓库目录对应的远端。
.PARAMETER GhPath
  可选，gh 可执行文件路径。默认取 PATH 里的 gh；主要用于用替身 gh 做自测。
.NOTES
  编码：gh 总是输出 UTF-8，但 PowerShell 默认按控制台代码页（中文 Windows 为 GBK）解码
  原生命令的 stdout，会把 Description 里的 em dash 读成 "?"。因此：
  1) 执行期间把 $OutputEncoding / [Console]::OutputEncoding 设为 UTF-8，结束时在 finally 里恢复；
  2) 回读不经过控制台解码，而是用 System.Diagnostics.Process 直接以 UTF-8 读 gh 的 stdout。
#>
[CmdletBinding()]
param(
    [string]$Repo,
    [string]$GhPath
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$Description = 'Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook — 迈向无人区：AI 原生软件工程指南'
$Homepage = 'https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/'
$Topics = @(
    'book', 'chinese', 'ai-native', 'sdlc', 'software-engineering',
    'agent-skills', 'guidebook', 'verification', 'architecture', 'methodology'
)

if ($Topics.Count -gt 10) {
    throw "Topics 超过 10 个：$($Topics.Count)"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

$GhExe = if ($GhPath) { $GhPath } else { (Get-Command gh -CommandType Application | Select-Object -First 1).Source }

function Format-CodePoints {
    param([string]$Text)
    if ($null -eq $Text) { return '(null)' }
    ($Text.EnumerateRunes() | ForEach-Object { 'U+{0:X4}' -f $_.Value }) -join ' '
}

function Invoke-GhUtf8 {
    param([string[]]$GhArgs)
    $psi = [System.Diagnostics.ProcessStartInfo]::new($script:GhExe)
    foreach ($a in $GhArgs) { $psi.ArgumentList.Add($a) }
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = $utf8
    $psi.StandardErrorEncoding = $utf8
    $proc = [System.Diagnostics.Process]::Start($psi)
    $outTask = $proc.StandardOutput.ReadToEndAsync()
    $errTask = $proc.StandardError.ReadToEndAsync()
    $proc.WaitForExit()
    if ($proc.ExitCode -ne 0) {
        throw "gh $($GhArgs -join ' ') 失败（exit $($proc.ExitCode)）：$($errTask.Result)"
    }
    $outTask.Result
}

$repoArgs = @()
if ($Repo) {
    $repoArgs = @('--repo', $Repo)
} else {
    Set-Location (Split-Path -Parent $PSScriptRoot)
}

$problems = @()
$savedOutputEncoding = $OutputEncoding
$savedConsoleEncoding = $null
try {
    try {
        $savedConsoleEncoding = [Console]::OutputEncoding
        [Console]::OutputEncoding = $utf8
    } catch {
        Write-Verbose "无法设置 [Console]::OutputEncoding（无控制台？）：$($_.Exception.Message)"
        $savedConsoleEncoding = $null
    }
    $OutputEncoding = $utf8

    $editArgs = @('repo', 'edit') + $repoArgs + @('--description', $Description, '--homepage', $Homepage)
    foreach ($topic in $Topics) {
        $editArgs += @('--add-topic', $topic)
    }

    Write-Host "设置 Description、Homepage 与 $($Topics.Count) 个 Topics ..."
    & $GhExe @editArgs

    Write-Host '回读：'
    $viewArgs = @('repo', 'view') + $repoArgs + @('--json', 'description,homepageUrl,repositoryTopics')
    $json = Invoke-GhUtf8 -GhArgs $viewArgs
    Write-Host $json

    $actual = $json | ConvertFrom-Json
    $actualTopics = @(@($actual.repositoryTopics) | Where-Object { $_ } | ForEach-Object {
            if ($_.name) { $_.name } else { $_.topic.name }
        })

    $expectedDesc = $Description.Trim()
    $actualDesc = ([string]$actual.description).Trim()
    if ($actualDesc -ne $expectedDesc) {
        $problems += "Description 不一致：期望 '$expectedDesc'，实际 '$actualDesc'"
        $problems += "  期望 ($($expectedDesc.Length) chars)：$(Format-CodePoints $expectedDesc)"
        $problems += "  实际 ($($actualDesc.Length) chars)：$(Format-CodePoints $actualDesc)"
        $limit = [Math]::Min($expectedDesc.Length, $actualDesc.Length)
        $idx = 0
        while ($idx -lt $limit -and $expectedDesc[$idx] -eq $actualDesc[$idx]) { $idx++ }
        $problems += "  首个差异位置：index $idx"
    }
    $expectedHome = $Homepage.Trim()
    $actualHome = ([string]$actual.homepageUrl).Trim()
    if ($actualHome -ne $expectedHome) {
        $problems += "Homepage 不一致：期望 '$expectedHome'，实际 '$actualHome'"
        $problems += "  期望 ($($expectedHome.Length) chars)：$(Format-CodePoints $expectedHome)"
        $problems += "  实际 ($($actualHome.Length) chars)：$(Format-CodePoints $actualHome)"
    }
    $missing = @($Topics | Where-Object { $_ -notin $actualTopics })
    if ($missing.Count -gt 0) {
        $problems += "缺少 Topics：$($missing -join ', ')"
    }

    if ($problems.Count -eq 0) {
        Write-Host '核对通过：Description、Homepage 与全部 Topics 已生效。'
    } else {
        $problems | ForEach-Object { Write-Host $_ }
    }
} finally {
    $OutputEncoding = $savedOutputEncoding
    if ($null -ne $savedConsoleEncoding) {
        try { [Console]::OutputEncoding = $savedConsoleEncoding } catch { Write-Verbose $_.Exception.Message }
    }
}

if ($problems.Count -gt 0) {
    exit 1
}
