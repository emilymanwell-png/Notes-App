# Simple HTTP Server for Notes App
# This fixes YouTube Error 153 by serving the app over HTTP instead of file://

$port = 8000
$path = $PSScriptRoot

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   Notes App Server Starting..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server running at: http://localhost:$port" -ForegroundColor Yellow
Write-Host ""
Write-Host "Open your browser and go to:" -ForegroundColor White
Write-Host "  http://localhost:$port/index.html" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Create HTTP listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Get requested file path
        $requestedPath = $request.Url.LocalPath
        if ($requestedPath -eq "/") {
            $requestedPath = "/index.html"
        }
        
        $filePath = Join-Path $path $requestedPath.TrimStart('/')
        
        Write-Host "$(Get-Date -Format 'HH:mm:ss') - Request: $requestedPath" -ForegroundColor Gray
        
        if (Test-Path $filePath -PathType Leaf) {
            # Determine content type
            $extension = [System.IO.Path]::GetExtension($filePath)
            $contentType = switch ($extension) {
                ".html" { "text/html" }
                ".css"  { "text/css" }
                ".js"   { "application/javascript" }
                ".json" { "application/json" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".gif"  { "image/gif" }
                ".svg"  { "image/svg+xml" }
                ".ico"  { "image/x-icon" }
                default { "application/octet-stream" }
            }
            
            # Read file and send response
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $content.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            # 404 Not Found
            $response.StatusCode = 404
            $html = "<h1>404 - File Not Found</h1><p>$requestedPath</p>"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        
        $response.Close()
    }
} finally {
    $listener.Stop()
    Write-Host "`nServer stopped." -ForegroundColor Yellow
}
