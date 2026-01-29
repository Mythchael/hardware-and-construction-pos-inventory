@echo off
:: 1. Set the current folder as working directory
cd /d "%~dp0"

:: 2. Launch the browser immediately
start http://localhost:3000

:: 3. Start the Server (This will take over the hidden window and stay running)
:: Note: This assumes you copied node.exe to this folder. 
:: If you are using installed Node, just use: node server.js
"%~dp0node.exe" server.js