@echo off
chcp 936 >nul 2>nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "ROOT=%CD%"
set "PY=%ROOT%\.venv\Scripts\python.exe"
REM 让 Python 输出与当前控制台编码一致，避免中文日志乱码
set "PYTHONIOENCODING=gbk"

echo ================================================
echo   辰光 Agent 平台 - 一键启动
echo   数据库: SQLite    缓存: fakeredis    (无需 Docker)
echo ================================================
echo.

REM ==================== 1. Python 环境 ====================
echo [1/5] 检查 Python 环境 ...
set "SYS_PY="
call :find_python

if not defined SYS_PY (
    echo.
    echo [错误] 未检测到可用的 Python，请安装 Python 3.13（3.10 及以上）。
    echo        安装时务必勾选 "Add Python to PATH"。
    echo        也可以先设置环境变量 CHENGUANG_PYTHON 指向 python.exe。
    echo.
    pause
    exit /b 1
)

REM 已有 .venv 时先验证是否真的能运行：跨机器拷贝来的环境常常指向不存在的解释器
set "VENV_OK=0"
if exist "%PY%" (
    "%PY%" -c "import sys" >nul 2>&1
    if not errorlevel 1 set "VENV_OK=1"
)

if "!VENV_OK!"=="1" (
    echo       虚拟环境已就绪
) else (
    if exist "%ROOT%\.venv" (
        echo       检测到 .venv 不可用（可能来自其他机器），正在重建 ...
        rmdir /s /q "%ROOT%\.venv"
        if exist "%ROOT%\.venv" (
            echo.
            echo [错误] 无法删除损坏的 .venv，请先关闭占用它的程序后重试。
            pause
            exit /b 1
        )
    ) else (
        echo       首次运行，正在创建虚拟环境 .venv ...
    )

    %SYS_PY% -m venv .venv
    if errorlevel 1 (
        echo.
        echo [错误] 虚拟环境创建失败，请确认 Python 安装完整。
        pause
        exit /b 1
    )
    if not exist "%PY%" (
        echo.
        echo [错误] 虚拟环境创建后未找到 python.exe。
        pause
        exit /b 1
    )
    echo       虚拟环境创建完成
)

REM ==================== 2. 后端依赖 ====================
echo [2/5] 检查后端依赖 ...
if not exist "%ROOT%\requirements.txt" (
    echo.
    echo [错误] 未找到 requirements.txt，无法安装后端依赖。
    pause
    exit /b 1
)

"%PY%" -c "import fastapi, uvicorn, aiosqlite, fakeredis, alembic, sqlalchemy, pydantic, loguru, jwt, bcrypt, captcha, minio, redis" >nul 2>&1
if errorlevel 1 (
    echo       依赖不完整，正在安装（首次运行需要几分钟）...
    "%PY%" -m pip install --disable-pip-version-check -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败。可尝试切换国内镜像后重试：
        echo        "%PY%" -m pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
        echo.
        pause
        exit /b 1
    )
    "%PY%" -c "import fastapi, uvicorn, aiosqlite, fakeredis, alembic, sqlalchemy, pydantic, loguru, jwt, bcrypt, captcha, minio, redis" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装后仍无法导入，请检查 requirements.txt 与 Python 版本。
        pause
        exit /b 1
    )
)
echo       后端依赖检查通过

REM ==================== 3. 数据库 ====================
echo [3/5] 准备数据库 ...
"%PY%" bootstrap_db.py
if errorlevel 1 (
    echo.
    echo [错误] 数据库初始化失败，请查看上方日志。
    pause
    exit /b 1
)

REM ==================== 4. 前端依赖 ====================
echo [4/5] 检查前端依赖 ...
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo.
    echo [错误] 未检测到 npm.cmd，请安装 Node.js 18 及以上版本。
    pause
    exit /b 1
)

if not exist "%ROOT%\app\node_modules\vite\package.json" goto :npm_install
if not exist "%ROOT%\app\node_modules\.bin\vite.cmd" goto :npm_install
echo       前端依赖已就绪
goto :frontend_done

:npm_install
echo       正在安装前端依赖（首次运行需要几分钟）...
pushd "%ROOT%\app"
call npm.cmd install --no-audit --no-fund
set "NPM_ERR=!ERRORLEVEL!"
popd
if not "!NPM_ERR!"=="0" (
    echo.
    echo [错误] npm 依赖安装失败，请确认 Node.js 版本并检查网络。
    pause
    exit /b 1
)
if not exist "%ROOT%\app\node_modules\.bin\vite.cmd" (
    echo.
    echo [错误] 前端依赖安装后仍缺少 vite，请删除 app\node_modules 后重试。
    pause
    exit /b 1
)
echo       前端依赖安装完成

:frontend_done

REM ==================== 5. 启动服务 ====================
echo [5/5] 启动服务 ...

call :port_busy 8080
if "!BUSY!"=="1" (
    echo       端口 8080 已被占用，跳过后端启动（可能已在运行）
) else (
    start "辰光Agent-后端 8080" cmd /k "cd /d ""%ROOT%"" && ""%PY%"" -m uvicorn src.main:app --host 127.0.0.1 --port 8080"
    echo       后端启动中 ...
)

call :port_busy 5173
if "!BUSY!"=="1" (
    echo       端口 5173 已被占用，跳过前端启动（可能已在运行）
) else (
    start "辰光Agent-前端 5173" cmd /k "cd /d ""%ROOT%\app"" && npm.cmd run dev"
    echo       前端启动中 ...
)

echo.
echo       等待服务就绪（未启动 MinIO 时后端约需 20 秒重试，属正常现象）...
"%PY%" wait_ready.py 120
set "READY=!ERRORLEVEL!"

echo.
echo ================================================
echo   后端 API 文档: http://localhost:8080/docs
echo   后端健康检查: http://localhost:8080/health
echo   前端界面:      http://localhost:5173
echo   默认账号:      admin / 123456
echo.
if "!READY!"=="0" (
    echo   启动完成，正在打开浏览器 ...
    start "" "http://localhost:5173"
) else (
    echo   等待服务超时，请查看后端/前端窗口中的错误日志。
)
echo.
echo   提示：请使用 localhost 访问前端（CORS 白名单不含 127.0.0.1）
echo   停止服务：直接关闭对应的后端/前端窗口
echo ================================================
echo.
pause
exit /b 0

REM ==================== 子程序：查找 Python ====================
:find_python
REM 1) 允许通过环境变量指定解释器
if defined CHENGUANG_PYTHON (
    set "SYS_PY=%CHENGUANG_PYTHON%"
    exit /b 0
)
REM 2) 优先 Python 3.13（项目推荐版本）
py -3.13 --version >nul 2>&1
if not errorlevel 1 (
    set "SYS_PY=py -3.13"
    exit /b 0
)
REM 3) PATH 中的 python
python --version >nul 2>&1
if not errorlevel 1 (
    set "SYS_PY=python"
    exit /b 0
)
REM 4) py 启动器任意 3.x
py -3 --version >nul 2>&1
if not errorlevel 1 (
    set "SYS_PY=py -3"
    exit /b 0
)
exit /b 0

REM ==================== 子程序：检查端口占用 ====================
:port_busy
set "BUSY=0"
netstat -ano | findstr "LISTENING" | findstr ":%~1" >nul 2>&1
if not errorlevel 1 set "BUSY=1"
exit /b 0
