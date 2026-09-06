@echo off
chcp 65001 > nul
echo ===================================================
echo [SEBANG TEC] KOSHA-MS 사내 표준문서 웹 서비스 시작
echo ===================================================

if not exist bin mkdir bin

echo [1/2] Java 소스코드 컴파일 중...
javac -encoding UTF-8 -d bin src\com\sebang\kosha\Main.java
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 컴파일 실패! 오류를 확인하세요.
    pause
    exit /b %ERRORLEVEL%
)

echo [2/2] 서버 기동 중... (http://localhost:8080)
java -cp bin com.sebang.kosha.Main
pause
