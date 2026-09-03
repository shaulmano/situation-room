@echo off
REM Scan the sources that only answer an Israeli IP.
REM
REM MalamTeam returns Cloudflare's "Just a moment..." challenge with HTTP 403 to
REM a GitHub runner, and SQLink comes back empty from one too - both answer
REM normally from here. Nothing else needs to run locally, so this scans exactly
REM those two and pushes straight to Supabase, the same way the cloud scan does.
REM
REM Register it to run hourly (adjust as you like):
REM   schtasks /create /tn "SituationRoom-LocalScan" /tr "C:\Users\Shaul\Documents\situation-room\sync\local_scan.cmd" /sc hourly /f
REM Remove it:
REM   schtasks /delete /tn "SituationRoom-LocalScan" /f

cd /d "%~dp0.."
set PYTHONIOENCODING=utf-8
python sync\scan_sources.py malamteam sqlink >> "%TEMP%\situation-room-local-scan.log" 2>&1
