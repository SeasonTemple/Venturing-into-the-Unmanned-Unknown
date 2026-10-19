#Requires -Version 7.3
<#
.SYNOPSIS
  设置 GitHub 仓库 About（Description 与 Topics），并回读核对。
.PARAMETER Repo
  可选，OWNER/REPO。省略时使用当前仓库目录对应的远端。
#>
[CmdletBinding()]
param(
    [string]$Repo
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$Description = 'Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook — 迈向无人区：AI 原生软件工程指南'
$Topics = @(
    'book', 'chinese', 'ai-native', 'sdlc', 'software-engineering',
    'agent-skills', 'guidebook', 'verification', 'architecture', 'methodology'
)

if ($Topics.Count -gt 10) {
    throw "Topics 超过 10 个：$($Topics.Count)"
}

$repoArgs = @()
if ($Repo) {
    $repoArgs = @('--repo', $Repo)
} else {
    Set-Location (Split-Path -Parent $PSScriptRoot)
}

$editArgs = @('repo', 'edit') + $repoArgs + @('--description', $Description)
foreach ($topic in $Topics) {
    $editArgs += @('--add-topic', $topic)
}

Write-Host "设置 Description 与 $($Topics.Count) 个 Topics ..."
& gh @editArgs

Write-Host '回读：'
$viewArgs = @('repo', 'view') + $repoArgs + @('--json', 'description,repositoryTopics')
$json = & gh @viewArgs
$json | Write-Host

$actual = $json | ConvertFrom-Json
$actualTopics = @(@($actual.repositoryTopics) | Where-Object { $_ } | ForEach-Object {
        if ($_.name) { $_.name } else { $_.topic.name }
    })

$problems = @()
if ($actual.description -ne $Description) {
    $problems += "Description 不一致：期望 '$Description'，实际 '$($actual.description)'"
}
$missing = @($Topics | Where-Object { $_ -notin $actualTopics })
if ($missing.Count -gt 0) {
    $problems += "缺少 Topics：$($missing -join ', ')"
}

if ($problems.Count -gt 0) {
    $problems | ForEach-Object { Write-Error $_ -ErrorAction Continue }
    exit 1
}

Write-Host '核对通过：Description 与全部 Topics 已生效。'
