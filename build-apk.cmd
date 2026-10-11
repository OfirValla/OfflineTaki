@echo off
setlocal EnableExtensions
REM ------------------------------------------------------------------------------
REM  Offline TAKI - builds an installable Android APK.
REM
REM    build-apk.cmd                 release APK (default; this is what players install)
REM    build-apk.cmd debug           debug APK (loads JavaScript from Metro on this PC)
REM    build-apk.cmd release clean   clean the Android build first
REM
REM  Output: android\app\build\outputs\apk\<variant>\app-<variant>.apk
REM          plus a copy in dist\OfflineTaki-<version>-<variant>.apk
REM
REM  Requirements: Node.js 22+, JDK 17 (JAVA_HOME), Android SDK (ANDROID_HOME) with
REM  platform android-37.0, build-tools 37.0.0 and NDK 28.2.13676358. See docs\BUILD.md.
REM ------------------------------------------------------------------------------

set "ROOT=%~dp0"
set "VARIANT=%~1"
if "%VARIANT%"=="" set "VARIANT=release"
if /I not "%VARIANT%"=="release" if /I not "%VARIANT%"=="debug" (
  echo Unknown variant "%VARIANT%". Use "release" or "debug".
  exit /b 1
)

where node >nul 2>nul || (
  echo [build-apk] Node.js was not found on PATH. Install Node.js 22 or newer.
  exit /b 1
)
where java >nul 2>nul || (
  echo [build-apk] Java was not found on PATH. Install JDK 17 and set JAVA_HOME.
  exit /b 1
)
if not defined ANDROID_HOME if not defined ANDROID_SDK_ROOT (
  echo [build-apk] ANDROID_HOME is not set. Point it at your Android SDK folder.
  exit /b 1
)

pushd "%ROOT%"

if not exist node_modules (
  echo [build-apk] Installing npm dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [build-apk] npm install failed.
    popd
    exit /b 1
  )
)

if not exist android\keystore.properties (
  echo [build-apk] WARNING: android\keystore.properties is missing.
  echo [build-apk]          The release APK will be signed with the debug key.
  echo [build-apk]          See docs\BUILD.md to set up the release keystore.
)

if /I "%~2"=="clean" (
  echo [build-apk] Cleaning previous build...
  call android\gradlew.bat -p android clean --console=plain
  if errorlevel 1 (
    popd
    exit /b 1
  )
)

if /I "%VARIANT%"=="release" (
  set "TASK=assembleRelease"
) else (
  set "TASK=assembleDebug"
)

echo [build-apk] Building %VARIANT% APK ^(this takes a few minutes the first time^)...
call android\gradlew.bat -p android %TASK% --console=plain
if errorlevel 1 (
  echo.
  echo [build-apk] BUILD FAILED. Scroll up for the Gradle error.
  popd
  exit /b 1
)

set "APK=android\app\build\outputs\apk\%VARIANT%\app-%VARIANT%.apk"
if not exist "%APK%" (
  echo [build-apk] Build reported success but %APK% was not found.
  popd
  exit /b 1
)

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "VERSION=%%v"
if not exist dist mkdir dist
set "OUT=dist\OfflineTaki-%VERSION%-%VARIANT%.apk"
copy /y "%APK%" "%OUT%" >nul

echo.
echo [build-apk] APK ready:
echo     %ROOT%%APK%
echo     %ROOT%%OUT%
echo.
echo [build-apk] Install over USB:   adb install -r "%ROOT%%OUT%"
echo [build-apk] Or copy the file to the phone and open it from the Files app.
popd
endlocal
exit /b 0
