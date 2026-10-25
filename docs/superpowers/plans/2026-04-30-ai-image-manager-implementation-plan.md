# AI Image Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app for managing AI image-generation cases, with generation, manual records, tags, search, sorting, path replacement, settings, and a pluggable image-provider backend.

**Architecture:** Flask serves a local browser app and JSON APIs. SQLite stores permanent instance metadata, tags, input image paths, and output image paths, while real image files stay on disk. Image generation goes through provider classes so the current AIAPIS/gpt-image-2 scripts can be migrated first and additional代理商 can be added by creating new provider modules.

**Tech Stack:** Python 3.12, Flask, SQLite, OpenAI Python SDK, pytest, vanilla HTML/CSS/JavaScript, Windows CMD launcher.

---

## Execution Note

The current workspace is not a git repository. Do not run `git init` unless the user explicitly asks. At the end of each task, run the listed verification command. If a git repository exists when this plan is executed, make the suggested checkpoint commit; otherwise record the verification result in the final task notes.

## File Map

- Create `requirements.txt`: Python dependencies.
- Create `app.py`: app factory, service startup, browser opening.
- Create `Open-AIImageManager.cmd`: double-click launcher.
- Create `AIImageManager.config.json`: default app/provider settings.
- Create `backend/__init__.py`: backend package marker.
- Create `backend/database.py`: schema creation, SQLite connection, CRUD, filtering, sorting, serialization.
- Create `backend/config.py`: read/write JSON config with defaults.
- Create `backend/api.py`: Flask routes for instances, tags, settings, dialogs, image serving, generation, path replacement.
- Create `backend/file_dialogs.py`: Windows-friendly file and directory pickers using `tkinter`.
- Create `backend/image_generation.py`: high-level generation orchestration and provider dispatch.
- Create `backend/path_tools.py`: path replacement preview/apply and database backup.
- Create `backend/image_providers/__init__.py`: provider registry exports.
- Create `backend/image_providers/base.py`: provider protocol and result dataclass.
- Create `backend/image_providers/aiapis_gpt_image_2.py`: migrated provider based on existing `generate_image2.py` and `generate_image2_img2img.py`.
- Create `frontend/index.html`: app shell.
- Create `frontend/styles.css`: compact two-zone layout and row-paired saved-instance grid.
- Create `frontend/app.js`: client state, API calls, rendering, interaction handlers.
- Create `tests/test_database.py`: database CRUD/filter behavior.
- Create `tests/test_config.py`: config default/read/write behavior.
- Create `tests/test_path_tools.py`: path replacement preview/apply behavior.
- Create `tests/test_api.py`: API behavior with Flask test client.
- Create `tests/test_image_generation.py`: generation dispatch with fake provider.

## Task 1: Project Skeleton And Dependencies

**Files:**
- Create: `requirements.txt`
- Create: `app.py`
- Create: `Open-AIImageManager.cmd`
- Create: `backend/__init__.py`
- Create: `frontend/index.html`
- Create: `frontend/styles.css`
- Create: `frontend/app.js`

- [ ] **Step 1: Create dependency file**

Create `requirements.txt` with:

```text
Flask==3.0.3
openai==1.99.9
pytest==8.3.4
```

- [ ] **Step 2: Create package and static shell**

Create `backend/__init__.py` as an empty file.

Create `frontend/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI 生图管理</title>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">AI 生图管理</div>
    <nav class="tabs">
      <button class="tab is-active" data-page="manager">生图管理</button>
      <button class="tab" data-page="settings">设置</button>
    </nav>
  </header>
  <main id="app" class="app-shell"></main>
  <script src="/static/app.js"></script>
</body>
</html>
```

Create `frontend/styles.css`:

```css
:root {
  --bg: #f6f7f8;
  --panel: #ffffff;
  --ink: #1f2933;
  --muted: #667085;
  --line: #d9dee7;
  --line-strong: #aab4c2;
  --accent: #2563eb;
  --danger: #c2410c;
  --tag: #eef4ff;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background: var(--bg);
  font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
}
.topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
.brand { font-size: 18px; font-weight: 700; }
.tabs { display: flex; gap: 8px; }
button {
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  border-radius: 6px;
  padding: 7px 10px;
  cursor: pointer;
}
button:hover { border-color: var(--line-strong); }
.tab.is-active,
.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.danger { color: var(--danger); border-color: #fdba74; }
.app-shell { padding: 18px; }
```

Create `frontend/app.js`:

```javascript
const app = document.querySelector("#app");

function renderBootScreen() {
  app.innerHTML = `
    <section class="panel">
      <h1>AI 生图管理</h1>
      <p>应用正在初始化。</p>
    </section>
  `;
}

renderBootScreen();
```

- [ ] **Step 3: Create Flask app shell**

Create `app.py`:

```python
from __future__ import annotations

import argparse
import threading
import webbrowser
from pathlib import Path

from flask import Flask, send_from_directory


ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"


def create_app() -> Flask:
    app = Flask(__name__, static_folder=str(FRONTEND), static_url_path="/static")

    @app.get("/")
    def index():
        return send_from_directory(FRONTEND, "index.html")

    return app


def main() -> int:
    parser = argparse.ArgumentParser(description="AI Image Manager local web app")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--open", action="store_true")
    args = parser.parse_args()

    app = create_app()
    url = f"http://{args.host}:{args.port}/"
    print(f"Serving {url}")
    if args.open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    app.run(host=args.host, port=args.port, debug=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

Create `Open-AIImageManager.cmd`:

```bat
@echo off
cd /d "%~dp0"
python app.py --open
```

- [ ] **Step 4: Verify app shell starts**

Run:

```powershell
python -m pip install -r requirements.txt
python app.py --port 8787
```

Expected: console prints `Serving http://127.0.0.1:8787/` and visiting that URL displays `AI 生图管理`.

Stop the server with `Ctrl+C`.

## Task 2: Config File Handling

**Files:**
- Create: `backend/config.py`
- Create: `AIImageManager.config.json`
- Create: `tests/test_config.py`
- Modify: `app.py`

- [ ] **Step 1: Write config tests**

Create `tests/test_config.py`:

```python
from backend.config import DEFAULT_CONFIG, load_config, save_config


def test_load_config_creates_defaults(tmp_path):
    path = tmp_path / "config.json"
    config = load_config(path)

    assert config["active_provider"] == DEFAULT_CONFIG["active_provider"]
    assert config["default_output_dir"] == ""
    assert path.exists()


def test_save_config_round_trips(tmp_path):
    path = tmp_path / "config.json"
    config = load_config(path)
    config["default_output_dir"] = "D:\\AIOutput"
    config["providers"]["aiapis_gpt_image_2"]["model"] = "gpt-image-2"

    save_config(path, config)

    loaded = load_config(path)
    assert loaded["default_output_dir"] == "D:\\AIOutput"
    assert loaded["providers"]["aiapis_gpt_image_2"]["model"] == "gpt-image-2"
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pytest tests/test_config.py -v
```

Expected: FAIL because `backend.config` does not exist.

- [ ] **Step 3: Implement config module**

Create `backend/config.py`:

```python
from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any


DEFAULT_CONFIG: dict[str, Any] = {
    "active_provider": "aiapis_gpt_image_2",
    "default_output_dir": "",
    "default_size": "1024x1024",
    "providers": {
        "aiapis_gpt_image_2": {
            "display_name": "AIAPIS gpt-image-2",
            "base_url": "https://img.aiapis.help/v1",
            "api_key_env": "IMG_API_KEY",
            "api_key": "",
            "model": "gpt-image-2",
            "default_size": "1024x1024"
        }
    }
}


def deep_merge(defaults: dict[str, Any], loaded: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(defaults)
    for key, value in loaded.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        save_config(path, DEFAULT_CONFIG)
        return copy.deepcopy(DEFAULT_CONFIG)
    loaded = json.loads(path.read_text(encoding="utf-8"))
    config = deep_merge(DEFAULT_CONFIG, loaded)
    save_config(path, config)
    return config


def save_config(path: Path, config: dict[str, Any]) -> None:
    path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
```

Create `AIImageManager.config.json`:

```json
{
  "active_provider": "aiapis_gpt_image_2",
  "default_output_dir": "",
  "default_size": "1024x1024",
  "providers": {
    "aiapis_gpt_image_2": {
      "display_name": "AIAPIS gpt-image-2",
      "base_url": "https://img.aiapis.help/v1",
      "api_key_env": "IMG_API_KEY",
      "api_key": "",
      "model": "gpt-image-2",
      "default_size": "1024x1024"
    }
  }
}
```

- [ ] **Step 4: Wire config load into app startup**

Modify `app.py` imports:

```python
from backend.config import load_config
```

Add after constants:

```python
CONFIG_FILE = ROOT / "AIImageManager.config.json"
```

Inside `create_app()` before route definitions:

```python
    app.config["APP_CONFIG"] = load_config(CONFIG_FILE)
    app.config["CONFIG_FILE"] = CONFIG_FILE
```

- [ ] **Step 5: Verify config tests pass**

Run:

```powershell
pytest tests/test_config.py -v
```

Expected: 2 passed.

## Task 3: SQLite Schema And Instance CRUD

**Files:**
- Create: `backend/database.py`
- Create: `tests/test_database.py`
- Modify: `app.py`

- [ ] **Step 1: Write database tests**

Create `tests/test_database.py`:

```python
from pathlib import Path

from backend.database import (
    create_instance,
    delete_instance,
    get_connection,
    get_instance,
    init_db,
    list_instances,
    update_instance,
)


def make_db(tmp_path: Path):
    db_path = tmp_path / "app.sqlite"
    conn = get_connection(db_path)
    init_db(conn)
    return conn


def test_create_and_get_manual_instance(tmp_path):
    conn = make_db(tmp_path)
    instance_id = create_instance(
        conn,
        {
            "prompt": "极简产品海报",
            "mode": "text_to_image",
            "source": "manual",
            "provider": None,
            "generation_path": "",
            "output_image_path": "",
            "input_image_paths": ["C:\\in\\a.png", "C:\\in\\b.png"],
            "tags": ["产品", "海报"],
        },
    )

    item = get_instance(conn, instance_id)

    assert item["prompt"] == "极简产品海报"
    assert item["output_image_path"] == ""
    assert item["input_image_paths"] == ["C:\\in\\a.png", "C:\\in\\b.png"]
    assert item["tags"] == ["产品", "海报"]


def test_update_instance_replaces_images_and_tags(tmp_path):
    conn = make_db(tmp_path)
    instance_id = create_instance(
        conn,
        {
            "prompt": "old",
            "mode": "unspecified",
            "source": "manual",
            "provider": None,
            "generation_path": "",
            "output_image_path": "",
            "input_image_paths": [],
            "tags": ["旧"],
        },
    )

    update_instance(
        conn,
        instance_id,
        {
            "prompt": "new prompt",
            "mode": "image_to_image",
            "source": "manual",
            "provider": None,
            "generation_path": "",
            "output_image_path": "C:\\out\\one.png",
            "input_image_paths": ["C:\\in\\one.png"],
            "tags": ["新", "参考"],
        },
    )

    item = get_instance(conn, instance_id)
    assert item["prompt"] == "new prompt"
    assert item["output_image_path"] == "C:\\out\\one.png"
    assert item["input_image_paths"] == ["C:\\in\\one.png"]
    assert item["tags"] == ["新", "参考"]


def test_list_filters_by_prompt_and_tags_with_and_logic(tmp_path):
    conn = make_db(tmp_path)
    create_instance(conn, {"prompt": "产品海报", "mode": "text_to_image", "source": "manual", "provider": None, "generation_path": "", "output_image_path": "", "input_image_paths": [], "tags": ["产品", "海报"]})
    create_instance(conn, {"prompt": "产品摄影", "mode": "text_to_image", "source": "manual", "provider": None, "generation_path": "", "output_image_path": "", "input_image_paths": [], "tags": ["产品"]})

    result = list_instances(conn, {"q": "产品", "tags": ["产品", "海报"], "source": "all", "sort": "created_desc", "page": 1, "per_page": 50})

    assert result["total"] == 1
    assert result["items"][0]["prompt"] == "产品海报"
    assert result["items"][0]["display_index"] == 1


def test_delete_removes_record_without_touching_paths(tmp_path):
    conn = make_db(tmp_path)
    instance_id = create_instance(conn, {"prompt": "x", "mode": "text_to_image", "source": "manual", "provider": None, "generation_path": "", "output_image_path": "C:\\out\\x.png", "input_image_paths": ["C:\\in\\x.png"], "tags": []})

    delete_instance(conn, instance_id)

    assert get_instance(conn, instance_id) is None
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pytest tests/test_database.py -v
```

Expected: FAIL because `backend.database` does not exist.

- [ ] **Step 3: Implement schema and CRUD**

Create `backend/database.py` with:

```python
from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def get_connection(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS instances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prompt TEXT NOT NULL,
          mode TEXT NOT NULL,
          source TEXT NOT NULL,
          provider TEXT,
          generation_path TEXT NOT NULL DEFAULT '',
          output_image_path TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS input_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
          path TEXT NOT NULL,
          position INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS instance_tags (
          instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (instance_id, tag_id)
        );
        CREATE INDEX IF NOT EXISTS idx_instances_created_at ON instances(created_at);
        CREATE INDEX IF NOT EXISTS idx_instances_prompt ON instances(prompt);
        """
    )
    conn.commit()
```

Add helpers in the same file:

```python
def normalize_tags(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for tag in tags:
        name = tag.strip()
        if name and name not in seen:
            seen.add(name)
            result.append(name)
    return result


def set_input_images(conn: sqlite3.Connection, instance_id: int, paths: list[str]) -> None:
    conn.execute("DELETE FROM input_images WHERE instance_id = ?", (instance_id,))
    for index, path in enumerate(paths):
        if path:
            conn.execute(
                "INSERT INTO input_images(instance_id, path, position) VALUES (?, ?, ?)",
                (instance_id, path, index),
            )


def tag_id(conn: sqlite3.Connection, name: str) -> int:
    conn.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (name,))
    row = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
    return int(row["id"])


def set_tags(conn: sqlite3.Connection, instance_id: int, tags: list[str]) -> None:
    conn.execute("DELETE FROM instance_tags WHERE instance_id = ?", (instance_id,))
    for name in normalize_tags(tags):
        conn.execute(
            "INSERT INTO instance_tags(instance_id, tag_id) VALUES (?, ?)",
            (instance_id, tag_id(conn, name)),
        )


def hydrate_instance(conn: sqlite3.Connection, row: sqlite3.Row, display_index: int | None = None) -> dict[str, Any]:
    input_paths = [
        r["path"]
        for r in conn.execute(
            "SELECT path FROM input_images WHERE instance_id = ? ORDER BY position",
            (row["id"],),
        )
    ]
    tags = [
        r["name"]
        for r in conn.execute(
            """
            SELECT tags.name
            FROM tags
            JOIN instance_tags ON instance_tags.tag_id = tags.id
            WHERE instance_tags.instance_id = ?
            ORDER BY tags.name
            """,
            (row["id"],),
        )
    ]
    item = dict(row)
    item["input_image_paths"] = input_paths
    item["tags"] = tags
    if display_index is not None:
        item["display_index"] = display_index
    return item
```

Add CRUD in the same file:

```python
def create_instance(conn: sqlite3.Connection, payload: dict[str, Any]) -> int:
    timestamp = now_iso()
    prompt = payload["prompt"].strip()
    if not prompt:
        raise ValueError("提示词不能为空")
    with conn:
        cur = conn.execute(
            """
            INSERT INTO instances(prompt, mode, source, provider, generation_path, output_image_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                prompt,
                payload.get("mode", "unspecified"),
                payload.get("source", "manual"),
                payload.get("provider"),
                payload.get("generation_path", ""),
                payload.get("output_image_path", ""),
                timestamp,
                timestamp,
            ),
        )
        instance_id = int(cur.lastrowid)
        set_input_images(conn, instance_id, payload.get("input_image_paths", []))
        set_tags(conn, instance_id, payload.get("tags", []))
    return instance_id


def update_instance(conn: sqlite3.Connection, instance_id: int, payload: dict[str, Any]) -> None:
    prompt = payload["prompt"].strip()
    if not prompt:
        raise ValueError("提示词不能为空")
    with conn:
        conn.execute(
            """
            UPDATE instances
            SET prompt = ?, mode = ?, source = ?, provider = ?, generation_path = ?, output_image_path = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                prompt,
                payload.get("mode", "unspecified"),
                payload.get("source", "manual"),
                payload.get("provider"),
                payload.get("generation_path", ""),
                payload.get("output_image_path", ""),
                now_iso(),
                instance_id,
            ),
        )
        set_input_images(conn, instance_id, payload.get("input_image_paths", []))
        set_tags(conn, instance_id, payload.get("tags", []))


def get_instance(conn: sqlite3.Connection, instance_id: int) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM instances WHERE id = ?", (instance_id,)).fetchone()
    if row is None:
        return None
    return hydrate_instance(conn, row)


def delete_instance(conn: sqlite3.Connection, instance_id: int) -> None:
    with conn:
        conn.execute("DELETE FROM instances WHERE id = ?", (instance_id,))
```

Add listing in the same file:

```python
SORT_SQL = {
    "created_desc": "created_at DESC, id DESC",
    "created_asc": "created_at ASC, id ASC",
    "prompt_asc": "prompt COLLATE NOCASE ASC, id ASC",
    "prompt_desc": "prompt COLLATE NOCASE DESC, id DESC",
}


def list_instances(conn: sqlite3.Connection, filters: dict[str, Any]) -> dict[str, Any]:
    where: list[str] = []
    params: list[Any] = []
    q = (filters.get("q") or "").strip()
    if q:
        where.append("prompt LIKE ?")
        params.append(f"%{q}%")
    source = filters.get("source") or "all"
    if source != "all":
        where.append("source = ?")
        params.append(source)
    start_date = filters.get("start_date") or ""
    end_date = filters.get("end_date") or ""
    if start_date:
        where.append("created_at >= ?")
        params.append(start_date)
    if end_date:
        where.append("created_at <= ?")
        params.append(end_date)
    for tag in normalize_tags(filters.get("tags", [])):
        where.append(
            """
            EXISTS (
              SELECT 1 FROM instance_tags it
              JOIN tags t ON t.id = it.tag_id
              WHERE it.instance_id = instances.id AND t.name = ?
            )
            """
        )
        params.append(tag)

    where_sql = "WHERE " + " AND ".join(where) if where else ""
    total = int(conn.execute(f"SELECT COUNT(*) AS count FROM instances {where_sql}", params).fetchone()["count"])
    page = max(1, int(filters.get("page") or 1))
    per_page = int(filters.get("per_page") or 50)
    if per_page not in (50, 100, 200):
        per_page = 50
    sort_sql = SORT_SQL.get(filters.get("sort") or "created_desc", SORT_SQL["created_desc"])
    offset = (page - 1) * per_page
    rows = conn.execute(
        f"SELECT * FROM instances {where_sql} ORDER BY {sort_sql} LIMIT ? OFFSET ?",
        [*params, per_page, offset],
    ).fetchall()
    items = [hydrate_instance(conn, row, display_index=offset + index + 1) for index, row in enumerate(rows)]
    return {"items": items, "total": total, "page": page, "per_page": per_page}
```

- [ ] **Step 4: Initialize database at startup**

Modify `app.py` imports:

```python
from backend.database import get_connection, init_db
```

Add constants:

```python
DATA_DIR = ROOT / "data"
DB_FILE = DATA_DIR / "AIImageManager.data.sqlite"
```

Inside `create_app()` after config setup:

```python
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = get_connection(DB_FILE)
    init_db(conn)
    conn.close()
    app.config["DB_FILE"] = DB_FILE
```

- [ ] **Step 5: Verify database tests pass**

Run:

```powershell
pytest tests/test_database.py -v
```

Expected: 4 passed.

## Task 4: Flask API For Instances And Tags

**Files:**
- Create: `backend/api.py`
- Create: `tests/test_api.py`
- Modify: `app.py`

- [ ] **Step 1: Write API tests**

Create `tests/test_api.py`:

```python
from pathlib import Path

from app import create_app


def make_client(tmp_path: Path):
    app = create_app(db_file=tmp_path / "test.sqlite", config_file=tmp_path / "config.json")
    app.config.update(TESTING=True)
    return app.test_client()


def test_create_list_update_delete_instance(tmp_path):
    client = make_client(tmp_path)

    create_resp = client.post(
        "/api/instances",
        json={
            "prompt": "产品海报",
            "mode": "text_to_image",
            "source": "manual",
            "provider": None,
            "generation_path": "",
            "output_image_path": "",
            "input_image_paths": [],
            "tags": ["产品"],
        },
    )
    assert create_resp.status_code == 201
    instance_id = create_resp.get_json()["item"]["id"]

    list_resp = client.get("/api/instances?q=产品&tags=产品&sort=created_desc&per_page=50&page=1")
    assert list_resp.status_code == 200
    assert list_resp.get_json()["total"] == 1

    update_resp = client.put(
        f"/api/instances/{instance_id}",
        json={
            "prompt": "更新后的产品海报",
            "mode": "text_to_image",
            "source": "manual",
            "provider": None,
            "generation_path": "",
            "output_image_path": "C:\\out\\one.png",
            "input_image_paths": ["C:\\in\\one.png"],
            "tags": ["产品", "海报"],
        },
    )
    assert update_resp.status_code == 200
    assert update_resp.get_json()["item"]["tags"] == ["产品", "海报"]

    delete_resp = client.delete(f"/api/instances/{instance_id}")
    assert delete_resp.status_code == 204


def test_empty_prompt_returns_400(tmp_path):
    client = make_client(tmp_path)
    resp = client.post("/api/instances", json={"prompt": "   "})
    assert resp.status_code == 400
    assert "提示词不能为空" in resp.get_json()["error"]
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pytest tests/test_api.py -v
```

Expected: FAIL because `create_app` does not accept test paths and routes do not exist.

- [ ] **Step 3: Make app factory testable**

Modify `app.py` function signature:

```python
def create_app(db_file: Path | None = None, config_file: Path | None = None) -> Flask:
```

Inside `create_app()`, compute files:

```python
    resolved_config_file = config_file or CONFIG_FILE
    resolved_db_file = db_file or DB_FILE
    app.config["APP_CONFIG"] = load_config(resolved_config_file)
    app.config["CONFIG_FILE"] = resolved_config_file
    resolved_db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = get_connection(resolved_db_file)
    init_db(conn)
    conn.close()
    app.config["DB_FILE"] = resolved_db_file
```

Remove the old duplicated config and DB initialization lines.

- [ ] **Step 4: Implement API blueprint**

Create `backend/api.py`:

```python
from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from backend.database import create_instance, delete_instance, get_connection, get_instance, list_instances, update_instance


api = Blueprint("api", __name__, url_prefix="/api")


def db():
    return get_connection(current_app.config["DB_FILE"])


def payload_json() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return {}
    return data


@api.get("/instances")
def api_list_instances():
    tags = request.args.getlist("tags")
    if len(tags) == 1 and "," in tags[0]:
        tags = [part for part in tags[0].split(",") if part]
    filters = {
        "q": request.args.get("q", ""),
        "tags": tags,
        "source": request.args.get("source", "all"),
        "start_date": request.args.get("start_date", ""),
        "end_date": request.args.get("end_date", ""),
        "sort": request.args.get("sort", "created_desc"),
        "page": request.args.get("page", "1"),
        "per_page": request.args.get("per_page", "50"),
    }
    conn = db()
    try:
        return jsonify(list_instances(conn, filters))
    finally:
        conn.close()


@api.post("/instances")
def api_create_instance():
    conn = db()
    try:
        instance_id = create_instance(conn, payload_json())
        return jsonify({"item": get_instance(conn, instance_id)}), 201
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    finally:
        conn.close()


@api.put("/instances/<int:instance_id>")
def api_update_instance(instance_id: int):
    conn = db()
    try:
        update_instance(conn, instance_id, payload_json())
        item = get_instance(conn, instance_id)
        if item is None:
            return jsonify({"error": "实例不存在"}), 404
        return jsonify({"item": item})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    finally:
        conn.close()


@api.delete("/instances/<int:instance_id>")
def api_delete_instance(instance_id: int):
    conn = db()
    try:
        delete_instance(conn, instance_id)
        return "", 204
    finally:
        conn.close()
```

Modify `app.py` imports:

```python
from backend.api import api
```

Inside `create_app()` before returning:

```python
    app.register_blueprint(api)
```

- [ ] **Step 5: Verify API tests pass**

Run:

```powershell
pytest tests/test_api.py -v
```

Expected: 2 passed.

## Task 5: Settings API And File Dialogs

**Files:**
- Create: `backend/file_dialogs.py`
- Modify: `backend/api.py`
- Modify: `tests/test_api.py`

- [ ] **Step 1: Add settings API tests**

Append to `tests/test_api.py`:

```python
def test_settings_round_trip(tmp_path):
    client = make_client(tmp_path)

    get_resp = client.get("/api/settings")
    assert get_resp.status_code == 200
    config = get_resp.get_json()["settings"]
    config["default_output_dir"] = "D:\\AIOutput"

    save_resp = client.put("/api/settings", json=config)
    assert save_resp.status_code == 200

    after_resp = client.get("/api/settings")
    assert after_resp.get_json()["settings"]["default_output_dir"] == "D:\\AIOutput"
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
pytest tests/test_api.py::test_settings_round_trip -v
```

Expected: FAIL with 404 for `/api/settings`.

- [ ] **Step 3: Implement settings routes**

Modify `backend/api.py` imports:

```python
from backend.config import save_config
```

Add routes:

```python
@api.get("/settings")
def api_get_settings():
    return jsonify({"settings": current_app.config["APP_CONFIG"]})


@api.put("/settings")
def api_save_settings():
    data = payload_json()
    save_config(current_app.config["CONFIG_FILE"], data)
    current_app.config["APP_CONFIG"] = data
    return jsonify({"settings": data})
```

- [ ] **Step 4: Implement file dialog helpers**

Create `backend/file_dialogs.py`:

```python
from __future__ import annotations

import tkinter as tk
from tkinter import filedialog


IMAGE_FILETYPES = [
    ("Image files", "*.png *.jpg *.jpeg *.webp *.bmp"),
    ("All files", "*.*"),
]


def choose_directory(initial_dir: str = "") -> str:
    root = tk.Tk()
    root.withdraw()
    try:
        return filedialog.askdirectory(initialdir=initial_dir or None) or ""
    finally:
        root.destroy()


def choose_images() -> list[str]:
    root = tk.Tk()
    root.withdraw()
    try:
        paths = filedialog.askopenfilenames(filetypes=IMAGE_FILETYPES)
        return list(paths)
    finally:
        root.destroy()
```

Modify `backend/api.py` imports:

```python
from backend.file_dialogs import choose_directory, choose_images
```

Add routes:

```python
@api.post("/dialogs/directory")
def api_choose_directory():
    initial_dir = payload_json().get("initial_dir", "")
    return jsonify({"path": choose_directory(initial_dir)})


@api.post("/dialogs/images")
def api_choose_images():
    return jsonify({"paths": choose_images()})
```

- [ ] **Step 5: Verify settings API test passes**

Run:

```powershell
pytest tests/test_api.py::test_settings_round_trip -v
```

Expected: 1 passed.

## Task 6: Local Image Serving

**Files:**
- Modify: `backend/api.py`
- Modify: `tests/test_api.py`

- [ ] **Step 1: Add image serving tests**

Append to `tests/test_api.py`:

```python
def test_image_route_serves_existing_file(tmp_path):
    client = make_client(tmp_path)
    image = tmp_path / "sample.png"
    image.write_bytes(b"\x89PNG\r\n\x1a\n")

    resp = client.get("/api/image", query_string={"path": str(image)})

    assert resp.status_code == 200
    assert resp.data == b"\x89PNG\r\n\x1a\n"


def test_image_route_returns_404_for_missing_file(tmp_path):
    client = make_client(tmp_path)
    resp = client.get("/api/image", query_string={"path": str(tmp_path / "missing.png")})

    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pytest tests/test_api.py::test_image_route_serves_existing_file tests/test_api.py::test_image_route_returns_404_for_missing_file -v
```

Expected: FAIL with 404 because `/api/image` does not exist.

- [ ] **Step 3: Implement image route**

Modify `backend/api.py` imports:

```python
from pathlib import Path
from flask import send_file
```

Add route:

```python
@api.get("/image")
def api_image():
    raw_path = request.args.get("path", "")
    path = Path(raw_path)
    if not raw_path or not path.exists() or not path.is_file():
        return jsonify({"error": "图片未找到"}), 404
    return send_file(path)
```

- [ ] **Step 4: Verify image route tests pass**

Run:

```powershell
pytest tests/test_api.py::test_image_route_serves_existing_file tests/test_api.py::test_image_route_returns_404_for_missing_file -v
```

Expected: 2 passed.

## Task 7: Path Replacement And Backup

**Files:**
- Create: `backend/path_tools.py`
- Create: `tests/test_path_tools.py`
- Modify: `backend/api.py`

- [ ] **Step 1: Write path replacement tests**

Create `tests/test_path_tools.py`:

```python
from pathlib import Path

from backend.database import create_instance, get_connection, init_db
from backend.path_tools import apply_path_replacement, preview_path_replacement


def make_db(tmp_path: Path):
    db_path = tmp_path / "app.sqlite"
    conn = get_connection(db_path)
    init_db(conn)
    create_instance(
        conn,
        {
            "prompt": "path case",
            "mode": "text_to_image",
            "source": "manual",
            "provider": None,
            "generation_path": "",
            "output_image_path": "C:\\old\\out.png",
            "input_image_paths": ["C:\\old\\in.png", "D:\\keep\\x.png"],
            "tags": [],
        },
    )
    return db_path, conn


def test_preview_counts_matching_paths(tmp_path):
    db_path, conn = make_db(tmp_path)

    preview = preview_path_replacement(conn, "C:\\old", "D:\\new")

    assert preview["matched_instances"] == 1
    assert preview["matched_paths"] == 2
    assert preview["examples"][0]["before"].startswith("C:\\old")
    conn.close()


def test_apply_replaces_paths_and_creates_backup(tmp_path):
    db_path, conn = make_db(tmp_path)
    backup_dir = tmp_path / "backups"

    result = apply_path_replacement(conn, db_path, backup_dir, "C:\\old", "D:\\new")

    assert result["matched_paths"] == 2
    assert list(backup_dir.glob("*.sqlite"))
    rows = conn.execute("SELECT output_image_path FROM instances").fetchall()
    assert rows[0]["output_image_path"] == "D:\\new\\out.png"
    input_rows = [row["path"] for row in conn.execute("SELECT path FROM input_images ORDER BY position")]
    assert input_rows == ["D:\\new\\in.png", "D:\\keep\\x.png"]
    conn.close()
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pytest tests/test_path_tools.py -v
```

Expected: FAIL because `backend.path_tools` does not exist.

- [ ] **Step 3: Implement path tools**

Create `backend/path_tools.py`:

```python
from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


def replacement_examples(paths: list[tuple[str, int, str]], find_text: str, replace_text: str) -> list[dict[str, str]]:
    examples: list[dict[str, str]] = []
    for table_name, row_id, path in paths[:8]:
        examples.append(
            {
                "table": table_name,
                "id": str(row_id),
                "before": path,
                "after": path.replace(find_text, replace_text),
            }
        )
    return examples


def matching_paths(conn: sqlite3.Connection, find_text: str) -> list[tuple[str, int, str, int | None]]:
    rows: list[tuple[str, int, str, int | None]] = []
    for row in conn.execute("SELECT id, output_image_path FROM instances WHERE output_image_path LIKE ?", (f"%{find_text}%",)):
        rows.append(("instances", int(row["id"]), row["output_image_path"], None))
    for row in conn.execute("SELECT id, instance_id, path FROM input_images WHERE path LIKE ?", (f"%{find_text}%",)):
        rows.append(("input_images", int(row["id"]), row["path"], int(row["instance_id"])))
    return rows


def preview_path_replacement(conn: sqlite3.Connection, find_text: str, replace_text: str) -> dict[str, Any]:
    if not find_text:
        raise ValueError("查找内容不能为空")
    rows = matching_paths(conn, find_text)
    instance_ids = {
        row[1] if row[0] == "instances" else row[3]
        for row in rows
        if row[3] is not None or row[0] == "instances"
    }
    return {
        "matched_instances": len(instance_ids),
        "matched_paths": len(rows),
        "examples": replacement_examples([(r[0], r[1], r[2]) for r in rows], find_text, replace_text),
    }


def backup_database(db_path: Path, backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir / f"AIImageManager-backup-{stamp}.sqlite"
    shutil.copy2(db_path, backup_path)
    return backup_path


def apply_path_replacement(conn: sqlite3.Connection, db_path: Path, backup_dir: Path, find_text: str, replace_text: str) -> dict[str, Any]:
    preview = preview_path_replacement(conn, find_text, replace_text)
    backup_path = backup_database(db_path, backup_dir)
    with conn:
        for row in conn.execute("SELECT id, output_image_path FROM instances WHERE output_image_path LIKE ?", (f"%{find_text}%",)).fetchall():
            conn.execute(
                "UPDATE instances SET output_image_path = ?, updated_at = datetime('now') WHERE id = ?",
                (row["output_image_path"].replace(find_text, replace_text), row["id"]),
            )
        for row in conn.execute("SELECT id, path FROM input_images WHERE path LIKE ?", (f"%{find_text}%",)).fetchall():
            conn.execute(
                "UPDATE input_images SET path = ? WHERE id = ?",
                (row["path"].replace(find_text, replace_text), row["id"]),
            )
    return {**preview, "backup_path": str(backup_path)}
```

- [ ] **Step 4: Add path replacement API**

Modify `backend/api.py` imports:

```python
from backend.path_tools import apply_path_replacement, preview_path_replacement
```

Add routes:

```python
@api.post("/paths/replace/preview")
def api_preview_path_replace():
    data = payload_json()
    conn = db()
    try:
        return jsonify(preview_path_replacement(conn, data.get("find", ""), data.get("replace", "")))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    finally:
        conn.close()


@api.post("/paths/replace/apply")
def api_apply_path_replace():
    data = payload_json()
    conn = db()
    try:
        backup_dir = current_app.config["DB_FILE"].parent / "backups"
        return jsonify(apply_path_replacement(conn, current_app.config["DB_FILE"], backup_dir, data.get("find", ""), data.get("replace", "")))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    finally:
        conn.close()
```

- [ ] **Step 5: Verify path tests pass**

Run:

```powershell
pytest tests/test_path_tools.py -v
```

Expected: 2 passed.

## Task 8: Provider Interface And Generation Dispatch

**Files:**
- Create: `backend/image_providers/__init__.py`
- Create: `backend/image_providers/base.py`
- Create: `backend/image_generation.py`
- Create: `tests/test_image_generation.py`

- [ ] **Step 1: Write generation dispatch tests**

Create `tests/test_image_generation.py`:

```python
from pathlib import Path

from backend.image_generation import generate_image
from backend.image_providers.base import ImageGenerationResult, ImageProvider


class FakeProvider(ImageProvider):
    name = "fake"

    def text_to_image(self, prompt, output_dir, options):
        path = Path(output_dir) / "text.png"
        path.write_bytes(b"image")
        return ImageGenerationResult(output_path=str(path), provider=self.name)

    def image_to_image(self, prompt, input_images, output_dir, options):
        path = Path(output_dir) / "edit.png"
        path.write_bytes(b"image")
        return ImageGenerationResult(output_path=str(path), provider=self.name)


def test_text_to_image_requires_prompt(tmp_path):
    result = generate_image(
        provider=FakeProvider({}),
        mode="text_to_image",
        prompt="产品海报",
        input_images=[],
        output_dir=str(tmp_path),
        options={},
    )

    assert result.output_path.endswith("text.png")


def test_image_to_image_requires_input_image(tmp_path):
    try:
        generate_image(
            provider=FakeProvider({}),
            mode="image_to_image",
            prompt="改成海报",
            input_images=[],
            output_dir=str(tmp_path),
            options={},
        )
    except ValueError as exc:
        assert "图生图需要至少 1 张输入图" in str(exc)
    else:
        raise AssertionError("Expected ValueError")
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pytest tests/test_image_generation.py -v
```

Expected: FAIL because provider modules do not exist.

- [ ] **Step 3: Implement provider base and dispatch**

Create `backend/image_providers/base.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ImageGenerationResult:
    output_path: str
    provider: str


class ImageProvider:
    name = "base"

    def __init__(self, config: dict[str, Any]):
        self.config = config

    def text_to_image(self, prompt: str, output_dir: str, options: dict[str, Any]) -> ImageGenerationResult:
        raise NotImplementedError

    def image_to_image(self, prompt: str, input_images: list[str], output_dir: str, options: dict[str, Any]) -> ImageGenerationResult:
        raise NotImplementedError
```

Create `backend/image_generation.py`:

```python
from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.image_providers.base import ImageGenerationResult, ImageProvider


def generate_image(
    provider: ImageProvider,
    mode: str,
    prompt: str,
    input_images: list[str],
    output_dir: str,
    options: dict[str, Any],
) -> ImageGenerationResult:
    clean_prompt = prompt.strip()
    if not clean_prompt:
        raise ValueError("提示词不能为空")
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    if mode == "text_to_image":
        return provider.text_to_image(clean_prompt, output_dir, options)
    if mode == "image_to_image":
        if not input_images:
            raise ValueError("图生图需要至少 1 张输入图")
        return provider.image_to_image(clean_prompt, input_images, output_dir, options)
    raise ValueError("未知生成模式")
```

Create `backend/image_providers/__init__.py`:

```python
from backend.image_providers.base import ImageGenerationResult, ImageProvider

__all__ = ["ImageGenerationResult", "ImageProvider"]
```

- [ ] **Step 4: Verify dispatch tests pass**

Run:

```powershell
pytest tests/test_image_generation.py -v
```

Expected: 2 passed.

## Task 9: AIAPIS gpt-image-2 Provider

**Files:**
- Create: `backend/image_providers/aiapis_gpt_image_2.py`
- Modify: `backend/image_generation.py`
- Modify: `backend/api.py`

- [ ] **Step 1: Implement AIAPIS provider based on existing scripts**

Create `backend/image_providers/aiapis_gpt_image_2.py`:

```python
from __future__ import annotations

import base64
import os
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from urllib.request import urlretrieve

from openai import OpenAI

from backend.image_providers.base import ImageGenerationResult, ImageProvider


class AIAPISGptImage2Provider(ImageProvider):
    name = "aiapis_gpt_image_2"

    def api_key(self) -> str:
        direct = self.config.get("api_key", "")
        if direct:
            return direct
        env_name = self.config.get("api_key_env", "IMG_API_KEY")
        value = os.getenv(env_name, "")
        if not value:
            raise ValueError(f"缺少 API Key，请在设置页填写或设置环境变量 {env_name}")
        return value

    def client(self) -> OpenAI:
        return OpenAI(
            base_url=self.config.get("base_url", "https://img.aiapis.help/v1"),
            api_key=self.api_key(),
            default_headers={"User-Agent": "Mozilla/5.0 PowerShell/7.4"},
        )

    def filename(self, output_dir: str, prefix: str) -> Path:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        return Path(output_dir) / f"{prefix}-{stamp}.png"

    def save_response_image(self, item: Any, output_dir: str, prefix: str) -> str:
        output_path = self.filename(output_dir, prefix)
        if getattr(item, "b64_json", None):
            output_path.write_bytes(base64.b64decode(item.b64_json))
            return str(output_path)
        if getattr(item, "url", None):
            url = urljoin(self.config.get("base_url", ""), item.url)
            urlretrieve(url, output_path)
            return str(output_path)
        raise ValueError("生成响应没有包含图片 URL 或 b64_json")

    def text_to_image(self, prompt: str, output_dir: str, options: dict[str, Any]) -> ImageGenerationResult:
        resp = self.client().images.generate(
            model=self.config.get("model", "gpt-image-2"),
            prompt=prompt,
            n=1,
            size=options.get("size") or self.config.get("default_size", "1024x1024"),
        )
        return ImageGenerationResult(
            output_path=self.save_response_image(resp.data[0], output_dir, "txt2img"),
            provider=self.name,
        )

    def image_to_image(self, prompt: str, input_images: list[str], output_dir: str, options: dict[str, Any]) -> ImageGenerationResult:
        first_image = Path(input_images[0])
        if not first_image.exists():
            raise ValueError(f"输入图片不存在：{first_image}")
        with first_image.open("rb") as image_file:
            resp = self.client().images.edit(
                model=self.config.get("model", "gpt-image-2"),
                image=image_file,
                prompt=prompt,
                n=1,
                size=options.get("size") or self.config.get("default_size", "1024x1024"),
            )
        return ImageGenerationResult(
            output_path=self.save_response_image(resp.data[0], output_dir, "img2img"),
            provider=self.name,
        )
```

- [ ] **Step 2: Add provider factory**

Modify `backend/image_generation.py` imports:

```python
from backend.image_providers.aiapis_gpt_image_2 import AIAPISGptImage2Provider
```

Add:

```python
PROVIDERS = {
    "aiapis_gpt_image_2": AIAPISGptImage2Provider,
}


def provider_from_config(app_config: dict[str, Any]) -> ImageProvider:
    active = app_config.get("active_provider", "aiapis_gpt_image_2")
    provider_config = app_config.get("providers", {}).get(active, {})
    provider_cls = PROVIDERS.get(active)
    if provider_cls is None:
        raise ValueError(f"未知代理商：{active}")
    return provider_cls(provider_config)
```

- [ ] **Step 3: Add generation API**

Modify `backend/api.py` imports:

```python
from backend.image_generation import generate_image, provider_from_config
```

Add route:

```python
@api.post("/generate")
def api_generate():
    data = payload_json()
    conn = db()
    try:
        provider = provider_from_config(current_app.config["APP_CONFIG"])
        output_dir = data.get("generation_path") or current_app.config["APP_CONFIG"].get("default_output_dir", "")
        result = generate_image(
            provider=provider,
            mode=data.get("mode", "text_to_image"),
            prompt=data.get("prompt", ""),
            input_images=data.get("input_image_paths", []),
            output_dir=output_dir,
            options={"size": data.get("size") or current_app.config["APP_CONFIG"].get("default_size", "1024x1024")},
        )
        instance_id = create_instance(
            conn,
            {
                "prompt": data.get("prompt", ""),
                "mode": data.get("mode", "text_to_image"),
                "source": "generated",
                "provider": result.provider,
                "generation_path": output_dir,
                "output_image_path": result.output_path,
                "input_image_paths": data.get("input_image_paths", []),
                "tags": data.get("tags", []),
            },
        )
        return jsonify({"item": get_instance(conn, instance_id)})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    finally:
        conn.close()
```

- [ ] **Step 4: Verify non-network tests still pass**

Run:

```powershell
pytest tests -v
```

Expected: all current tests pass. This command must not call the live image API.

## Task 10: Frontend State, API Client, And Settings Page

**Files:**
- Modify: `frontend/app.js`
- Modify: `frontend/styles.css`

- [ ] **Step 1: Add reusable frontend state and API helpers**

Replace `frontend/app.js` with:

```javascript
const app = document.querySelector("#app");

const state = {
  page: "manager",
  settings: null,
  operation: {
    mode: "text_to_image",
    prompt: "",
    input_image_paths: [],
    output_image_path: "",
    tags: [],
    generation_path: ""
  },
  filters: {
    q: "",
    tags: [],
    source: "all",
    start_date: "",
    end_date: "",
    sort: "created_desc",
    page: 1,
    per_page: 50
  },
  instances: [],
  total: 0,
  editing: new Map()
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {"Content-Type": "application/json"},
    ...options
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function imageUrl(path) {
  return `/api/image?path=${encodeURIComponent(path)}`;
}

function setMessage(message, isError = false) {
  const box = document.querySelector(".message");
  if (box) {
    box.textContent = message;
    box.className = isError ? "message is-error" : "message";
  }
}
```

- [ ] **Step 2: Add settings renderer**

Append to `frontend/app.js`:

```javascript
function renderSettings() {
  const provider = state.settings.providers[state.settings.active_provider];
  app.innerHTML = `
    <section class="panel">
      <h1>设置</h1>
      <div class="form-grid">
        <label>当前代理商
          <select id="setting-provider">
            <option value="aiapis_gpt_image_2">AIAPIS gpt-image-2</option>
          </select>
        </label>
        <label>API Base URL
          <input id="setting-base-url" value="${escapeHtml(provider.base_url)}">
        </label>
        <label>API Key
          <input id="setting-api-key" value="${escapeHtml(provider.api_key)}" placeholder="可留空，使用环境变量">
        </label>
        <label>API Key 环境变量
          <input id="setting-api-key-env" value="${escapeHtml(provider.api_key_env)}">
        </label>
        <label>模型名称
          <input id="setting-model" value="${escapeHtml(provider.model)}">
        </label>
        <label>默认图片尺寸
          <input id="setting-size" value="${escapeHtml(provider.default_size)}">
        </label>
        <label>默认生成路径
          <div class="path-row">
            <input id="setting-output-dir" value="${escapeHtml(state.settings.default_output_dir)}">
            <button id="choose-default-dir">选择</button>
          </div>
        </label>
      </div>
      <div class="actions">
        <button class="primary" id="save-settings">保存设置</button>
      </div>
      <p class="message"></p>
    </section>
  `;
  document.querySelector("#save-settings").addEventListener("click", saveSettings);
  document.querySelector("#choose-default-dir").addEventListener("click", async () => {
    const result = await api("/api/dialogs/directory", {method: "POST", body: JSON.stringify({initial_dir: document.querySelector("#setting-output-dir").value})});
    if (result.path) document.querySelector("#setting-output-dir").value = result.path;
  });
}

async function saveSettings() {
  const active = document.querySelector("#setting-provider").value;
  const provider = state.settings.providers[active];
  provider.base_url = document.querySelector("#setting-base-url").value;
  provider.api_key = document.querySelector("#setting-api-key").value;
  provider.api_key_env = document.querySelector("#setting-api-key-env").value;
  provider.model = document.querySelector("#setting-model").value;
  provider.default_size = document.querySelector("#setting-size").value;
  state.settings.active_provider = active;
  state.settings.default_output_dir = document.querySelector("#setting-output-dir").value;
  state.settings.default_size = provider.default_size;
  const result = await api("/api/settings", {method: "PUT", body: JSON.stringify(state.settings)});
  state.settings = result.settings;
  setMessage("设置已保存");
}
```

- [ ] **Step 3: Add app boot and tab switching**

Append to `frontend/app.js`:

```javascript
function render() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.page === state.page);
  });
  if (state.page === "settings") renderSettings();
  else renderManager();
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.page = tab.dataset.page;
    render();
  });
});

async function boot() {
  const settings = await api("/api/settings");
  state.settings = settings.settings;
  state.operation.generation_path = state.settings.default_output_dir || "";
  await loadInstances();
  render();
}

boot().catch((error) => {
  app.innerHTML = `<section class="panel"><h1>启动失败</h1><p>${escapeHtml(error.message)}</p></section>`;
});
```

Add placeholder functions above `boot()` so the file runs until the manager task fills them:

```javascript
async function loadInstances() {
  state.instances = [];
  state.total = 0;
}

function renderManager() {
  app.innerHTML = `<section class="panel"><h1>生图管理</h1><p>主界面正在构建。</p></section>`;
}
```

- [ ] **Step 4: Add form CSS**

Append to `frontend/styles.css`:

```css
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 14px;
}
label { display: grid; gap: 6px; color: var(--muted); font-size: 13px; }
input, textarea, select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px;
  color: var(--ink);
  background: #fff;
  font: inherit;
}
textarea { min-height: 96px; resize: vertical; }
.path-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.actions { margin-top: 14px; display: flex; gap: 8px; align-items: center; }
.message { min-height: 20px; color: var(--muted); }
.message.is-error { color: var(--danger); }
```

- [ ] **Step 5: Verify settings page manually**

Run:

```powershell
python app.py --port 8787 --open
```

Expected: settings tab renders all fields, save updates `AIImageManager.config.json`, and no browser console errors appear.

## Task 11: Operation Area And Generation Flow

**Files:**
- Modify: `frontend/app.js`
- Modify: `frontend/styles.css`

- [ ] **Step 1: Implement operation area renderer**

Replace `renderManager()` in `frontend/app.js`:

```javascript
function renderManager() {
  app.innerHTML = `
    <section class="operation panel">
      <div class="section-head">
        <h1>操作区</h1>
        <div class="mode-toggle">
          <button class="${state.operation.mode === "text_to_image" ? "primary" : ""}" data-mode="text_to_image">文生图</button>
          <button class="${state.operation.mode === "image_to_image" ? "primary" : ""}" data-mode="image_to_image">图生图</button>
        </div>
      </div>
      <div class="operation-grid">
        <label>提示词
          <textarea id="op-prompt">${escapeHtml(state.operation.prompt)}</textarea>
        </label>
        <div>
          <div class="field-label">输入图片</div>
          <div class="image-slots" id="op-input-images">
            ${renderImageSlots(state.operation.input_image_paths, true, "op-input")}
          </div>
        </div>
        <div>
          <div class="field-label">输出图片</div>
          <div class="image-slots one-output">
            ${renderOutputSlot(state.operation.output_image_path, "op-output")}
          </div>
        </div>
      </div>
      <div class="tag-row">
        <input id="op-tag-input" placeholder="添加标签后按 Enter">
        <div class="tags">${state.operation.tags.map((tag) => renderTag(tag, "op", true)).join("")}</div>
      </div>
      <div class="path-row">
        <input id="op-generation-path" value="${escapeHtml(state.operation.generation_path)}" placeholder="生成路径">
        <button id="choose-generation-path">选择</button>
      </div>
      <div class="actions">
        <button class="primary" id="generate-image">生成</button>
        <button id="clear-operation">清空</button>
        <span class="message"></span>
      </div>
    </section>
    ${renderSaveArea()}
  `;
  bindOperationEvents();
  bindSaveAreaEvents();
}
```

Add helpers before `renderManager()`:

```javascript
function renderTag(tag, scope, removable = true) {
  const removeButton = removable ? `<button data-tag="${escapeHtml(tag)}" data-scope="${scope}" class="tag-remove">×</button>` : "";
  return `<span class="tag">${escapeHtml(tag)} ${removeButton}</span>`;
}

function renderImageSlots(paths, editable, prefix) {
  const slots = paths.map((path, index) => `
    <div class="image-slot">
      <img src="${imageUrl(path)}" alt="">
      ${editable ? `<button class="slot-remove" data-prefix="${prefix}" data-index="${index}">×</button>` : ""}
    </div>
  `);
  if (editable) {
    slots.push(`<button class="image-slot add-slot" data-prefix="${prefix}">+</button>`);
  }
  if (!slots.length) {
    slots.push(`<div class="image-slot empty-slot">无图片</div>`);
  }
  return slots.join("");
}

function renderOutputSlot(path, prefix, editable = true) {
  if (!path) {
    return editable
      ? `<button class="image-slot add-slot" data-prefix="${prefix}">+</button>`
      : `<div class="image-slot empty-slot">暂无输出图</div>`;
  }
  return `
    <div class="image-slot">
      <img src="${imageUrl(path)}" alt="">
      ${editable ? `<button class="slot-remove" data-prefix="${prefix}" data-index="0">×</button>` : ""}
    </div>
  `;
}
```

- [ ] **Step 2: Implement operation event handlers**

Append:

```javascript
function syncOperationInputs() {
  state.operation.prompt = document.querySelector("#op-prompt")?.value ?? state.operation.prompt;
  state.operation.generation_path = document.querySelector("#op-generation-path")?.value ?? state.operation.generation_path;
}

function bindOperationEvents() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      syncOperationInputs();
      state.operation.mode = button.dataset.mode;
      render();
    });
  });
  document.querySelector("#op-prompt").addEventListener("input", syncOperationInputs);
  document.querySelector("#op-generation-path").addEventListener("input", syncOperationInputs);
  document.querySelector("#choose-generation-path").addEventListener("click", chooseGenerationPath);
  document.querySelector("#generate-image").addEventListener("click", generateFromOperation);
  document.querySelector("#clear-operation").addEventListener("click", clearOperation);
  document.querySelector("#op-tag-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const tag = event.target.value.trim();
      if (tag && !state.operation.tags.includes(tag)) state.operation.tags.push(tag);
      event.target.value = "";
      syncOperationInputs();
      render();
    }
  });
  document.querySelectorAll(".tag-remove[data-scope='op']").forEach((button) => {
    button.addEventListener("click", () => {
      state.operation.tags = state.operation.tags.filter((tag) => tag !== button.dataset.tag);
      syncOperationInputs();
      render();
    });
  });
  document.querySelectorAll(".add-slot[data-prefix='op-input']").forEach((button) => button.addEventListener("click", addOperationInputImages));
  document.querySelectorAll(".add-slot[data-prefix='op-output']").forEach((button) => button.addEventListener("click", addOperationOutputImage));
  document.querySelectorAll(".slot-remove[data-prefix='op-input']").forEach((button) => button.addEventListener("click", () => {
    state.operation.input_image_paths.splice(Number(button.dataset.index), 1);
    syncOperationInputs();
    render();
  }));
  document.querySelectorAll(".slot-remove[data-prefix='op-output']").forEach((button) => button.addEventListener("click", () => {
    state.operation.output_image_path = "";
    syncOperationInputs();
    render();
  }));
}
```

Append async actions:

```javascript
async function chooseGenerationPath() {
  const result = await api("/api/dialogs/directory", {method: "POST", body: JSON.stringify({initial_dir: state.operation.generation_path})});
  if (result.path) {
    state.operation.generation_path = result.path;
    render();
  }
}

async function addOperationInputImages() {
  const result = await api("/api/dialogs/images", {method: "POST", body: JSON.stringify({})});
  state.operation.input_image_paths.push(...result.paths);
  render();
}

async function addOperationOutputImage() {
  const result = await api("/api/dialogs/images", {method: "POST", body: JSON.stringify({})});
  state.operation.output_image_path = result.paths[0] || "";
  render();
}

function clearOperation() {
  state.operation.prompt = "";
  state.operation.input_image_paths = [];
  state.operation.output_image_path = "";
  render();
}

async function generateFromOperation() {
  syncOperationInputs();
  try {
    const result = await api("/api/generate", {method: "POST", body: JSON.stringify(state.operation)});
    state.operation.output_image_path = result.item.output_image_path;
    await loadInstances();
    render();
    setMessage("生成成功，已自动保存");
  } catch (error) {
    setMessage(error.message, true);
  }
}
```

Add temporary save-area functions if not present:

```javascript
function renderSaveArea() {
  return `<section class="save-area panel"><h1>保存区</h1><p>保存区正在构建。</p></section>`;
}

function bindSaveAreaEvents() {}
```

- [ ] **Step 3: Add operation CSS**

Append to `frontend/styles.css`:

```css
.operation { margin-bottom: 16px; }
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.section-head h1 { margin: 0 0 12px; font-size: 20px; }
.mode-toggle { display: flex; gap: 8px; }
.operation-grid {
  display: grid;
  grid-template-columns: 1.25fr .95fr .8fr;
  gap: 12px;
  align-items: start;
}
.field-label {
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 6px;
}
.image-slots {
  display: grid;
  grid-template-columns: repeat(4, minmax(72px, 1fr));
  gap: 8px;
}
.one-output { grid-template-columns: minmax(92px, 140px); }
.image-slot {
  aspect-ratio: 1 / 1;
  min-height: 72px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #f9fafb;
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.image-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.add-slot {
  font-size: 24px;
  color: var(--muted);
}
.empty-slot {
  color: var(--muted);
  font-size: 12px;
}
.slot-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  padding: 0;
  background: rgba(255,255,255,.9);
}
.tag-row {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr;
  gap: 10px;
  align-items: start;
  margin-top: 12px;
}
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--tag);
  border: 1px solid #c7d7fe;
  font-size: 12px;
}
.tag-remove {
  border: 0;
  background: transparent;
  padding: 0 2px;
}
```

- [ ] **Step 4: Verify operation area renders**

Run:

```powershell
python app.py --port 8787 --open
```

Expected: operation area shows mode buttons, prompt, input image slots, one output slot, tags, generation path, generate, and clear. Clear removes prompt/input/output but keeps tags, mode, and path.

## Task 12: Save Area Rendering, Filtering, Editing, And Delete Confirmation

**Files:**
- Modify: `frontend/app.js`
- Modify: `frontend/styles.css`

- [ ] **Step 1: Implement instance loading and toolbar**

Replace `loadInstances()`:

```javascript
async function loadInstances() {
  const params = new URLSearchParams();
  Object.entries(state.filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== "") {
      params.set(key, value);
    }
  });
  const result = await api(`/api/instances?${params.toString()}`);
  state.instances = result.items;
  state.total = result.total;
}
```

Replace `renderSaveArea()`:

```javascript
function renderSaveArea() {
  return `
    <section class="save-area panel">
      <div class="section-head">
        <h1>保存区</h1>
        <div class="total">共 ${state.total} 条</div>
      </div>
      <div class="toolbar">
        <input id="filter-q" value="${escapeHtml(state.filters.q)}" placeholder="搜索提示词">
        <input id="filter-tags" value="${escapeHtml(state.filters.tags.join(","))}" placeholder="标签，逗号分隔">
        <select id="filter-source">
          <option value="all">全部来源</option>
          <option value="generated">生成</option>
          <option value="manual">手动</option>
        </select>
        <select id="filter-sort">
          <option value="created_desc">日期新到旧</option>
          <option value="created_asc">日期旧到新</option>
          <option value="prompt_asc">提示词 A-Z</option>
          <option value="prompt_desc">提示词 Z-A</option>
        </select>
        <select id="filter-per-page">
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
        </select>
        <button id="new-instance">新增实例</button>
        <button id="path-replace">路径批量替换</button>
      </div>
      <div class="instance-grid">
        ${renderInstanceRows()}
      </div>
    </section>
  `;
}
```

Add:

```javascript
function renderInstanceRows() {
  const rows = [];
  for (let index = 0; index < state.instances.length; index += 2) {
    const left = state.instances[index];
    const right = state.instances[index + 1];
    rows.push(`
      <div class="instance-row">
        ${renderInstanceCard(left)}
        ${right ? renderInstanceCard(right) : `<div class="instance-card is-empty"></div>`}
      </div>
    `);
  }
  return rows.join("");
}
```

- [ ] **Step 2: Implement instance card renderer**

Append:

```javascript
function renderInstanceCard(item) {
  const draft = state.editing.get(item.id) || item;
  const editing = state.editing.has(item.id);
  return `
    <article class="instance-card ${editing ? "is-editing" : ""}" data-id="${item.id}">
      <div class="instance-meta">
        <span>#${String(item.display_index).padStart(3, "0")}</span>
        <span>${item.source === "generated" ? "生成" : "手动保存"}</span>
        <span>${escapeHtml(item.created_at.slice(0, 10))}</span>
      </div>
      <label>提示词
        <textarea class="inst-prompt" ${editing ? "" : "readonly"}>${escapeHtml(draft.prompt)}</textarea>
      </label>
      <div class="instance-media">
        <div>
          <div class="field-label">输入图片</div>
          <div class="image-slots">${renderImageSlots(draft.input_image_paths, editing, `inst-input-${item.id}`)}</div>
        </div>
        <div>
          <div class="field-label">输出图片</div>
          <div class="image-slots one-output">${renderOutputSlot(draft.output_image_path, `inst-output-${item.id}`, editing)}</div>
        </div>
      </div>
      <div class="tags">${draft.tags.map((tag) => renderTag(tag, `inst-${item.id}`, editing)).join("")}${editing ? `<input class="inst-tag-input" placeholder="标签 Enter">` : ""}</div>
      <div class="instance-actions">
        ${editing ? `<button class="save-edit">保存</button><button class="cancel-edit">取消</button>` : `<button class="edit-instance">编辑</button>`}
        <button class="danger delete-instance">删除</button>
      </div>
    </article>
  `;
}
```

- [ ] **Step 3: Bind save-area events**

Replace `bindSaveAreaEvents()`:

```javascript
function bindSaveAreaEvents() {
  document.querySelector("#filter-source").value = state.filters.source;
  document.querySelector("#filter-sort").value = state.filters.sort;
  document.querySelector("#filter-per-page").value = String(state.filters.per_page);
  ["filter-q", "filter-tags", "filter-source", "filter-sort", "filter-per-page"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("change", applyFilters);
  });
  document.querySelector("#new-instance").addEventListener("click", createManualInstance);
  document.querySelector("#path-replace").addEventListener("click", openPathReplaceDialog);
  document.querySelectorAll(".edit-instance").forEach((button) => button.addEventListener("click", startEdit));
  document.querySelectorAll(".cancel-edit").forEach((button) => button.addEventListener("click", cancelEdit));
  document.querySelectorAll(".save-edit").forEach((button) => button.addEventListener("click", saveEdit));
  document.querySelectorAll(".delete-instance").forEach((button) => button.addEventListener("click", deleteInstance));
  document.querySelectorAll(".inst-tag-input").forEach((input) => input.addEventListener("keydown", addInstanceTag));
  document.querySelectorAll(".tag-remove[data-scope^='inst-']").forEach((button) => button.addEventListener("click", removeInstanceTag));
}
```

Append:

```javascript
async function applyFilters() {
  state.filters.q = document.querySelector("#filter-q").value;
  state.filters.tags = document.querySelector("#filter-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean);
  state.filters.source = document.querySelector("#filter-source").value;
  state.filters.sort = document.querySelector("#filter-sort").value;
  state.filters.per_page = Number(document.querySelector("#filter-per-page").value);
  state.filters.page = 1;
  await loadInstances();
  render();
}

function cardId(button) {
  return Number(button.closest(".instance-card").dataset.id);
}

function startEdit(event) {
  const id = cardId(event.target);
  const item = state.instances.find((instance) => instance.id === id);
  state.editing.set(id, JSON.parse(JSON.stringify(item)));
  render();
}

function cancelEdit(event) {
  state.editing.delete(cardId(event.target));
  render();
}

async function saveEdit(event) {
  const id = cardId(event.target);
  const card = event.target.closest(".instance-card");
  const draft = state.editing.get(id);
  draft.prompt = card.querySelector(".inst-prompt").value;
  const result = await api(`/api/instances/${id}`, {method: "PUT", body: JSON.stringify(draft)});
  state.editing.delete(id);
  await loadInstances();
  render();
  setMessage(`已保存 #${String(result.item.display_index || "").padStart(3, "0")}`);
}

async function deleteInstance(event) {
  const id = cardId(event.target);
  const confirmed = window.confirm("确认删除这条实例？\n这只会删除软件中的记录，不会删除电脑上的图片文件。");
  if (!confirmed) return;
  await api(`/api/instances/${id}`, {method: "DELETE"});
  await loadInstances();
  render();
}
```

Add:

```javascript
async function createManualInstance() {
  const prompt = window.prompt("请输入提示词");
  if (!prompt || !prompt.trim()) return;
  await api("/api/instances", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      mode: "unspecified",
      source: "manual",
      provider: null,
      generation_path: "",
      output_image_path: "",
      input_image_paths: [],
      tags: []
    })
  });
  await loadInstances();
  render();
}

function addInstanceTag(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const id = Number(event.target.closest(".instance-card").dataset.id);
  const draft = state.editing.get(id);
  const tag = event.target.value.trim();
  if (tag && !draft.tags.includes(tag)) draft.tags.push(tag);
  render();
}

function removeInstanceTag(event) {
  const id = Number(event.target.closest(".instance-card").dataset.id);
  const draft = state.editing.get(id);
  draft.tags = draft.tags.filter((tag) => tag !== event.target.dataset.tag);
  render();
}

function openPathReplaceDialog() {
  window.alert("路径批量替换将在下一项任务接入前端弹窗。");
}
```

- [ ] **Step 4: Add save-area CSS**

Append to `frontend/styles.css`:

```css
.save-area { margin-top: 16px; }
.toolbar {
  display: grid;
  grid-template-columns: 1.4fr 1fr .8fr .9fr .6fr auto auto;
  gap: 8px;
  margin-bottom: 14px;
}
.total { color: var(--muted); }
.instance-grid { display: grid; gap: 12px; }
.instance-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: stretch;
}
.instance-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px;
  background: #fff;
  display: grid;
  gap: 10px;
  min-width: 0;
}
.instance-card.is-editing { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.instance-card.is-empty { visibility: hidden; }
.instance-meta {
  display: flex;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
}
.instance-media {
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: 10px;
}
.instance-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
textarea[readonly] {
  background: #f9fafb;
}
@media (max-width: 980px) {
  .operation-grid,
  .instance-row,
  .toolbar,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Verify save-area behavior manually**

Run:

```powershell
python app.py --port 8787 --open
```

Expected: creating manual instances renders row-major pairs `#001 #002`, `#003 #004`; editing changes border color; deleting shows the exact confirmation text and removes only the record.

## Task 13: Path Replacement Frontend Dialog

**Files:**
- Modify: `frontend/app.js`
- Modify: `frontend/styles.css`

- [ ] **Step 1: Implement path replacement dialog**

Replace `openPathReplaceDialog()`:

```javascript
function openPathReplaceDialog() {
  const dialog = document.createElement("div");
  dialog.className = "modal-backdrop";
  dialog.innerHTML = `
    <div class="modal">
      <h2>路径批量替换</h2>
      <label>查找内容 A
        <input id="replace-find" placeholder="例如 C:\\old">
      </label>
      <label>替换为 B
        <input id="replace-with" placeholder="例如 D:\\new">
      </label>
      <div class="actions">
        <button id="preview-replace">预览影响</button>
        <button class="primary" id="apply-replace" disabled>确认替换</button>
        <button id="close-replace">关闭</button>
      </div>
      <div id="replace-preview" class="preview-box"></div>
    </div>
  `;
  document.body.appendChild(dialog);
  document.querySelector("#close-replace").addEventListener("click", () => dialog.remove());
  document.querySelector("#preview-replace").addEventListener("click", async () => {
    const find = document.querySelector("#replace-find").value;
    const replace = document.querySelector("#replace-with").value;
    try {
      const preview = await api("/api/paths/replace/preview", {method: "POST", body: JSON.stringify({find, replace})});
      document.querySelector("#replace-preview").innerHTML = renderPathPreview(preview);
      document.querySelector("#apply-replace").disabled = preview.matched_paths === 0;
    } catch (error) {
      document.querySelector("#replace-preview").textContent = error.message;
      document.querySelector("#apply-replace").disabled = true;
    }
  });
  document.querySelector("#apply-replace").addEventListener("click", async () => {
    const find = document.querySelector("#replace-find").value;
    const replace = document.querySelector("#replace-with").value;
    const confirmed = window.confirm("确认替换数据库中的图片路径？\n替换前会自动备份数据库，不会移动或删除电脑上的图片文件。");
    if (!confirmed) return;
    const result = await api("/api/paths/replace/apply", {method: "POST", body: JSON.stringify({find, replace})});
    document.querySelector("#replace-preview").innerHTML = `<p>已替换 ${result.matched_paths} 个路径。备份：${escapeHtml(result.backup_path)}</p>`;
    await loadInstances();
    render();
  });
}

function renderPathPreview(preview) {
  return `
    <p>影响实例：${preview.matched_instances} 条；影响路径：${preview.matched_paths} 个。</p>
    <div class="preview-list">
      ${preview.examples.map((item) => `
        <div class="preview-item">
          <div>修改前：${escapeHtml(item.before)}</div>
          <div>修改后：${escapeHtml(item.after)}</div>
        </div>
      `).join("")}
    </div>
  `;
}
```

- [ ] **Step 2: Add modal CSS**

Append to `frontend/styles.css`:

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .35);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 20;
}
.modal {
  width: min(720px, 100%);
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
  display: grid;
  gap: 12px;
}
.preview-box {
  max-height: 260px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 10px;
  background: #f9fafb;
}
.preview-list { display: grid; gap: 8px; }
.preview-item {
  border-bottom: 1px solid var(--line);
  padding-bottom: 8px;
  font-size: 12px;
}
```

- [ ] **Step 3: Verify path replacement UI manually**

Run:

```powershell
python app.py --port 8787 --open
```

Expected: path replacement dialog previews affected paths, requires confirmation, shows backup path, and the saved instances refresh after replacement.

## Task 14: Final Integration Verification

**Files:**
- Modify only files needed to fix failures found by the commands in this task.

- [ ] **Step 1: Run full Python test suite**

Run:

```powershell
pytest tests -v
```

Expected: all tests pass.

- [ ] **Step 2: Run Flask app smoke test**

Run:

```powershell
python app.py --port 8787 --open
```

Expected:

- Browser opens the app.
- 生图管理 tab loads without console errors.
- 设置 tab loads current config.
- Manual instance creation works.
- Filtering by prompt works.
- Filtering by multiple comma-separated tags uses AND behavior.
- Editing an instance in place works.
- Delete confirmation uses the specified wording.
- Path replacement preview works and creates a backup when applied.

- [ ] **Step 3: Validate generation preconditions without live API**

In the UI:

- Select 文生图, leave prompt empty, click 生成. Expected: error says `提示词不能为空`.
- Select 图生图, enter prompt, leave input images empty, click 生成. Expected: error says `图生图需要至少 1 张输入图`.

- [ ] **Step 4: Validate live generation when API key is available**

Set the API key:

```powershell
$env:IMG_API_KEY = "your-key-here"
python app.py --port 8787 --open
```

In the UI:

- Set a valid generation path.
- Use 文生图 with a short prompt.
- Click 生成.

Expected:

- One image file is written to the selected generation path.
- One generated instance appears in 保存区.
- The instance source shows 生成.
- The instance has the operation tags.
- The operation prompt, tags, mode, and generation path remain after generation.

- [ ] **Step 5: Record non-git checkpoint**

If this workspace is still not a git repository, write a short implementation note in the final response listing:

- tests run
- manual smoke checks run
- live generation status

If this workspace is a git repository, run:

```powershell
git status --short
git add app.py Open-AIImageManager.cmd requirements.txt AIImageManager.config.json backend frontend tests docs/superpowers/plans/2026-04-30-ai-image-manager-implementation-plan.md
git commit -m "feat: build AI image manager local web app"
```

Expected: commit succeeds and `git status --short` shows no tracked changes.

## Self-Review Checklist

- Spec coverage: operation area, save area, manual instances, inline editing, delete confirmation, tags, AND filtering, sorting, pagination, SQLite, config JSON, provider architecture, settings page, image serving, path replacement, and non-deletion of real files are covered by tasks.
- Placeholder scan: the plan contains no placeholder task names and no deferred implementation notes inside tasks.
- Type consistency: API payload fields use `prompt`, `mode`, `source`, `provider`, `generation_path`, `output_image_path`, `input_image_paths`, and `tags` consistently across database, API, generation, and frontend tasks.
