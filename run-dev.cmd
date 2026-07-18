@echo off
cd /d "%~dp0"
set NODE_ENV=development
npx tsx watch server/_core/index.ts
