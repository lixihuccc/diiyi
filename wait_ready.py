"""等待前后端服务就绪，供 start.bat 在启动后轮询调用。

用法: python wait_ready.py [超时秒数]
退出码: 0 = 两个服务均已就绪；1 = 超时未就绪
"""
from __future__ import annotations

import sys
import time
import urllib.request

TARGETS = [
    ("后端", "http://127.0.0.1:8080/health"),
    ("前端", "http://localhost:5173"),
]


def wait(name: str, url: str, timeout: int) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)
            print(f"       {name}就绪    {url}", flush=True)
            return True
        except Exception:  # noqa: BLE001
            time.sleep(1)
    print(f"       {name}启动超时 {url}", flush=True)
    return False


def main() -> int:
    timeout = int(sys.argv[1]) if len(sys.argv) > 1 else 90
    ok = all(wait(name, url, timeout) for name, url in TARGETS)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
