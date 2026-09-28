from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import uuid
from contextlib import closing
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
try:
    import trafilatura
except ImportError:
    trafilatura = None
from bs4 import BeautifulSoup
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, HttpUrl

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
IMAGE_DIR = DATA_DIR / "images"
DB_PATH = DATA_DIR / "recipes.db"
DATA_DIR.mkdir(exist_ok=True)
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Ricette Locali", version="0.1.0")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.mount("/images", StaticFiles(directory=IMAGE_DIR), name="images")


class ImportRequest(BaseModel):
    urls: list[HttpUrl]


class RecipeUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    categories: list[str] | None = None
    ingredients: list[str] | None = None
    instructions: list[str] | None = None
    favorite: bool | None = None
    status: str | None = None
    manual_text: str | None = None


class ManualRecipeCreate(BaseModel):
    title: str
    description: str = ""
    categories: list[str] = Field(default_factory=list)
    ingredients: list[str] = Field(default_factory=list)
    instructions: list[str] = Field(default_factory=list)
    prep_time: str = ""
    cook_time: str = ""
    servings: str = ""
    manual_text: str = ""


SECTION_HEADER = re.compile(
    r"^\s*(?:[-*#]\s*)?(ingredienti|occorrente|procedimento|preparazione|istruzioni|istruzione|metodo)\s*:?[\s-]*$",
    re.IGNORECASE,
)


def split_manual_text(value: str) -> tuple[str, list[str] | None, list[str] | None]:
    """Extract explicitly labelled ingredient and instruction sections from notes."""
    sections: dict[str, list[str]] = {"ingredients": [], "instructions": []}
    found: set[str] = set()
    notes: list[str] = []
    current: str | None = None

    for raw_line in value.splitlines():
        header = SECTION_HEADER.match(raw_line)
        if header:
            label = header.group(1).lower()
            current = "ingredients" if label in {"ingredienti", "occorrente"} else "instructions"
            found.add(current)
            continue
        line = re.sub(r"^\s*(?:[-*]\s+|\d+[.)]\s+)", "", raw_line).strip()
        if not line:
            continue
        items = re.split(r"\s*;\s*|\s+-\s+", line) if current == "ingredients" else [line]
        items = [item.strip() for item in items if item.strip()]
        if current:
            sections[current].extend(items)
        else:
            notes.append(line)

    if not found:
        return value, None, None
    remaining = "\n".join(notes)
    return remaining, sections["ingredients"] if "ingredients" in found else None, sections["instructions"] if "instructions" in found else None


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    with closing(connect()) as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS recipes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                author TEXT DEFAULT '',
                ingredients TEXT DEFAULT '[]',
                instructions TEXT DEFAULT '[]',
                prep_time TEXT DEFAULT '',
                cook_time TEXT DEFAULT '',
                total_time TEXT DEFAULT '',
                servings TEXT DEFAULT '',
                categories TEXT DEFAULT '[]',
                cuisine TEXT DEFAULT '',
                nutrition TEXT DEFAULT '{}',
                rating REAL,
                source_url TEXT NOT NULL UNIQUE,
                source_site TEXT DEFAULT '',
                image_path TEXT DEFAULT '',
                image_url TEXT DEFAULT '',
                image_hash TEXT DEFAULT '',
                status TEXT DEFAULT 'da provare',
                favorite INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS recipes_fts USING fts5(
                recipe_id UNINDEXED, title, description, ingredients, instructions, categories, cuisine
            );
            """
        )
        columns = {row[1] for row in db.execute("PRAGMA table_info(recipes)").fetchall()}
        if "manual_text" not in columns:
            db.execute("ALTER TABLE recipes ADD COLUMN manual_text TEXT DEFAULT ''")
        db.commit()


@app.on_event("startup")
def startup() -> None:
    init_db()


def decode_json(value: str, default: Any) -> Any:
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


def serialize_recipe(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    for field in ("ingredients", "instructions", "categories", "nutrition"):
        item[field] = decode_json(item[field], [] if field != "nutrition" else {})
    item["favorite"] = bool(item["favorite"])
    return item


def refresh_fts(db: sqlite3.Connection, recipe: dict[str, Any]) -> None:
    db.execute("DELETE FROM recipes_fts WHERE recipe_id = ?", (recipe["id"],))
    db.execute(
        "INSERT INTO recipes_fts(recipe_id, title, description, ingredients, instructions, categories, cuisine) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            recipe["id"], recipe["title"], recipe["description"],
            " ".join(recipe["ingredients"]), " ".join(recipe["instructions"]),
            " ".join(recipe["categories"]), recipe["cuisine"],
        ),
    )


def recipe_from_jsonld(payload: Any) -> dict[str, Any] | None:
    candidates = payload if isinstance(payload, list) else [payload]
    if isinstance(payload, dict) and isinstance(payload.get("@graph"), list):
        candidates = payload["@graph"]
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        kinds = candidate.get("@type", [])
        kinds = kinds if isinstance(kinds, list) else [kinds]
        if any(str(kind).lower() == "recipe" for kind in kinds):
            return candidate
    return None


def normalize_recipe(data: dict[str, Any], url: str, fallback_title: str = "Ricetta senza titolo") -> dict[str, Any]:
    def text(value: Any) -> str:
        if isinstance(value, dict):
            return str(value.get("name", ""))
        return str(value or "")

    def list_text(value: Any) -> list[str]:
        if isinstance(value, list):
            return [text(item).strip() for item in value if text(item).strip()]
        return [text(value).strip()] if text(value).strip() else []

    image = data.get("image", "")
    if isinstance(image, list):
        image = image[0] if image else ""
    if isinstance(image, dict):
        image = image.get("url", "")
    host = urlparse(url).netloc.replace("www.", "")
    return {
        "id": str(uuid.uuid4()), "title": text(data.get("name")) or fallback_title,
        "description": text(data.get("description")), "author": text(data.get("author")),
        "ingredients": list_text(data.get("recipeIngredient")),
        "instructions": list_text(data.get("recipeInstructions")),
        "prep_time": text(data.get("prepTime")), "cook_time": text(data.get("cookTime")),
        "total_time": text(data.get("totalTime")), "servings": text(data.get("recipeYield")),
        "categories": list_text(data.get("recipeCategory")), "cuisine": text(data.get("recipeCuisine")),
        "nutrition": data.get("nutrition", {}) if isinstance(data.get("nutrition", {}), dict) else {},
        "rating": data.get("aggregateRating", {}).get("ratingValue") if isinstance(data.get("aggregateRating"), dict) else None,
        "source_url": url, "source_site": host, "image_path": "", "image_url": urljoin(url, str(image)) if image else "",
        "image_hash": "", "status": "da provare", "favorite": 0,
    }


def extract_recipe(html: str, url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            structured = json.loads(script.string or script.get_text())
        except json.JSONDecodeError:
            continue
        recipe = recipe_from_jsonld(structured)
        if recipe:
            return normalize_recipe(recipe, url)

    title = soup.title.get_text(strip=True) if soup.title else "Ricetta importata"
    text = (trafilatura.extract(html) if trafilatura else None) or soup.get_text(" ", strip=True)
    return normalize_recipe({"name": title, "description": text[:1000]}, url, title)


def download_image(recipe: dict[str, Any], client: httpx.Client) -> None:
    if not recipe["image_url"]:
        return
    try:
        response = client.get(recipe["image_url"], follow_redirects=True, timeout=12)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("image/"):
            return
        digest = hashlib.sha256(response.content).hexdigest()
        extension = ".jpg" if "jpeg" in content_type else ".png" if "png" in content_type else ".webp"
        filename = f"{digest}{extension}"
        (IMAGE_DIR / filename).write_bytes(response.content)
        recipe["image_hash"] = digest
        recipe["image_path"] = f"/images/{filename}"
    except (httpx.HTTPError, OSError):
        return


def ollama_complete(recipe: dict[str, Any]) -> dict[str, Any]:
    endpoint = os.getenv("OLLAMA_URL", "http://localhost:11434") + "/api/generate"
    model = os.getenv("OLLAMA_MODEL", "llama3.2")
    prompt = "Estrai e normalizza questa ricetta. Rispondi solo JSON con title, description, ingredients (array), instructions (array), prep_time, cook_time, servings. Dati: " + json.dumps(recipe, ensure_ascii=False)
    try:
        response = httpx.post(endpoint, json={"model": model, "prompt": prompt, "format": "json", "stream": False}, timeout=90)
        response.raise_for_status()
        generated = response.json().get("response", "")
        parsed = json.loads(generated)
        for key, value in parsed.items():
            if value not in (None, "", []):
                recipe[key] = value
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError):
        pass
    return recipe


@app.get("/")
def index() -> FileResponse:
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/api/recipes")
def recipes(q: str = "", ingredient: str = "", exclude_ingredient: str = "", favorite: bool = False, status: str = "", limit: int | None = None) -> list[dict[str, Any]]:
    with closing(connect()) as db:
        if q.strip():
            query = "SELECT r.* FROM recipes r JOIN recipes_fts f ON f.recipe_id = r.id WHERE recipes_fts MATCH ?"
            params: list[Any] = [" ".join(f'"{part}"' for part in re.findall(r"[\wÀ-ÿ]+", q))]
        else:
            query, params = "SELECT r.* FROM recipes r WHERE 1=1", []
        if ingredient.strip():
            ingredient_terms = re.findall(r"[\wÀ-ÿ]+", ingredient)
            ingredient_match = " ".join(f'"{part}"' for part in ingredient_terms)
            query += " AND (r.title LIKE ? OR r.manual_text LIKE ? OR r.id IN (SELECT recipe_id FROM recipes_fts WHERE ingredients MATCH ?))"
            params.extend([f"%{ingredient}%", f"%{ingredient}%", ingredient_match])
        if exclude_ingredient.strip():
            excluded_terms = re.findall(r"[\wÀ-ÿ]+", exclude_ingredient)
            excluded_match = " ".join(f'"{part}"' for part in excluded_terms)
            query += " AND NOT (r.title LIKE ? OR r.manual_text LIKE ? OR r.id IN (SELECT recipe_id FROM recipes_fts WHERE ingredients MATCH ?))"
            params.extend([f"%{exclude_ingredient}%", f"%{exclude_ingredient}%", excluded_match])
        if favorite:
            query += " AND r.favorite = 1" if q.strip() else " AND favorite = 1"
        if status:
            query += " AND r.status = ?"; params.append(status)
        query += " ORDER BY updated_at DESC"
        if limit is not None:
            query += " LIMIT ?"; params.append(limit)
        return [serialize_recipe(row) for row in db.execute(query, params).fetchall()]


@app.get("/api/stats")
def stats() -> dict[str, int]:
    with closing(connect()) as db:
        row = db.execute("SELECT COUNT(*) total, SUM(favorite) favorites FROM recipes").fetchone()
        return {"total": row["total"] or 0, "favorites": row["favorites"] or 0}


@app.get("/api/search")
def search(q: str = Query(..., min_length=2), limit: int = Query(10, le=20)) -> list[dict[str, Any]]:
    endpoint = os.getenv("SEARXNG_URL", "http://localhost:8080/search")
    try:
        response = httpx.get(endpoint, params={"q": q, "format": "json", "categories": "general"}, timeout=15)
        response.raise_for_status()
        results = response.json().get("results", [])[:limit]
        with closing(connect()) as db:
            saved = {row[0] for row in db.execute("SELECT source_url FROM recipes")}
        return [{"title": item.get("title", ""), "url": item.get("url", ""), "description": item.get("content", ""), "source": urlparse(item.get("url", "")).netloc.replace("www.", ""), "saved": item.get("url") in saved} for item in results]
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(503, f"SearXNG non raggiungibile su {endpoint}") from error


@app.post("/api/import")
def import_recipes(request: ImportRequest) -> list[dict[str, Any]]:
    imported = []
    with httpx.Client(headers={"User-Agent": "RicetteLocali/0.1"}) as client, closing(connect()) as db:
        for raw_url in request.urls:
            url = str(raw_url)
            try:
                existing = db.execute("SELECT * FROM recipes WHERE source_url = ?", (url,)).fetchone()
                if existing:
                    imported.append(serialize_recipe(existing)); continue
                page = client.get(url, follow_redirects=True, timeout=25)
                page.raise_for_status()
                recipe = extract_recipe(page.text, url)
                if len(recipe["ingredients"]) < 2 and os.getenv("OLLAMA_ENABLED", "false").lower() == "true":
                    recipe = ollama_complete(recipe)
                download_image(recipe, client)
                columns = list(recipe.keys())
                values = [json.dumps(recipe[column], ensure_ascii=False) if isinstance(recipe[column], (list, dict)) else recipe[column] for column in columns]
                db.execute(f"INSERT INTO recipes ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})", values)
                refresh_fts(db, recipe)
                imported.append(recipe)
            except (httpx.HTTPError, sqlite3.IntegrityError, ValueError) as error:
                imported.append({"source_url": url, "error": str(error)})
        db.commit()
    return imported


@app.post("/api/recipes")
def create_manual_recipe(request: ManualRecipeCreate) -> dict[str, Any]:
    title = request.title.strip()
    if not title:
        raise HTTPException(422, "Il titolo è obbligatorio")
    recipe = {
        "id": str(uuid.uuid4()), "title": title, "description": request.description.strip(),
        "author": "", "ingredients": [item.strip() for item in request.ingredients if item.strip()],
        "instructions": [item.strip() for item in request.instructions if item.strip()],
        "prep_time": request.prep_time.strip(), "cook_time": request.cook_time.strip(), "total_time": "",
        "servings": request.servings.strip(), "categories": [item.strip() for item in request.categories if item.strip()],
        "cuisine": "", "nutrition": {}, "rating": None,
        "source_url": "manual://" + str(uuid.uuid4()), "source_site": "Inserita manualmente",
        "image_path": "", "image_url": "", "image_hash": "", "status": "da provare",
        "favorite": 0, "manual_text": request.manual_text.strip(),
    }
    columns = list(recipe)
    values = [json.dumps(recipe[column], ensure_ascii=False) if isinstance(recipe[column], (list, dict)) else recipe[column] for column in columns]
    with closing(connect()) as db:
        db.execute(f"INSERT INTO recipes ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})", values)
        refresh_fts(db, recipe)
        db.commit()
        row = db.execute("SELECT * FROM recipes WHERE id = ?", (recipe["id"],)).fetchone()
        return serialize_recipe(row)


@app.patch("/api/recipes/{recipe_id}")
def update_recipe(recipe_id: str, update: RecipeUpdate) -> dict[str, Any]:
    changes = update.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(400, "Nessuna modifica")
    if "manual_text" in changes:
        manual_text, ingredients, instructions = split_manual_text(changes["manual_text"])
        changes["manual_text"] = manual_text
        if ingredients is not None:
            changes["ingredients"] = ingredients
        if instructions is not None:
            changes["instructions"] = instructions
    encoded = {key: json.dumps(value, ensure_ascii=False) if isinstance(value, (list, dict)) else value for key, value in changes.items()}
    assignments = ", ".join(f"{key} = ?" for key in encoded) + ", updated_at = CURRENT_TIMESTAMP"
    with closing(connect()) as db:
        db.execute(f"UPDATE recipes SET {assignments} WHERE id = ?", [*encoded.values(), recipe_id])
        row = db.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Ricetta non trovata")
        recipe = serialize_recipe(row); refresh_fts(db, recipe); db.commit()
        return recipe


@app.post("/api/recipes/{recipe_id}/image")
async def upload_recipe_image(recipe_id: str, image: UploadFile = File(...)) -> dict[str, Any]:
    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(415, "Il file deve essere un'immagine")
    content = await image.read()
    if not content:
        raise HTTPException(400, "Il file immagine è vuoto")
    digest = hashlib.sha256(content).hexdigest()
    extension = ".jpg" if content_type in {"image/jpeg", "image/jpg"} else ".png" if content_type == "image/png" else ".webp" if content_type == "image/webp" else ".img"
    filename = f"{digest}{extension}"
    try:
        (IMAGE_DIR / filename).write_bytes(content)
    except OSError as error:
        raise HTTPException(500, "Impossibile salvare l'immagine") from error
    with closing(connect()) as db:
        db.execute("UPDATE recipes SET image_path = ?, image_url = ?, image_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (f"/images/{filename}", "", digest, recipe_id))
        row = db.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Ricetta non trovata")
        db.commit()
        return serialize_recipe(row)


@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: str) -> dict[str, bool]:
    with closing(connect()) as db:
        db.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,)); db.execute("DELETE FROM recipes_fts WHERE recipe_id = ?", (recipe_id,)); db.commit()
    return {"deleted": True}
