from dotenv import load_dotenv
load_dotenv()

import csv
import os
import re
import time
import hashlib
from io import BytesIO
from urllib.parse import urlparse
import requests




# ==========================
# CONFIG
# ==========================
SHEET_CSV_URL = os.getenv("SHEET_CSV_URL", "").strip()  # your published CSV link
CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
API_KEY = os.getenv("CLOUDINARY_API_KEY", "").strip()
API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "").strip()

# Optional: where to store images on Cloudinary
BASE_FOLDER = os.getenv("CLOUDINARY_BASE_FOLDER", "tabzollection").strip()

# Safety: pause between requests to avoid rate limits
SLEEP_SECONDS = float(os.getenv("SLEEP_SECONDS", "0.4"))

OUT_CSV = os.getenv("OUT_CSV", "products_cloudinary.csv").strip()

RE_DRIVE_ID = re.compile(r"/file/d/([^/]+)/|id=([^&\s]+)")

def must_env(name: str, value: str):
    if not value:
        raise SystemExit(f"Missing env var: {name}")

def extract_drive_id(url: str) -> str | None:
    """
    Supports:
    - https://drive.google.com/file/d/<ID>/view?...
    - https://drive.google.com/uc?export=view&id=<ID>
    """
    m = RE_DRIVE_ID.search(url)
    if not m:
        return None
    return m.group(1) or m.group(2)

def drive_direct_download_url(file_id: str) -> str:
    # Use direct download endpoint
    return f"https://drive.google.com/uc?export=download&id={file_id}"

def download_drive_file(url: str) -> bytes:
    """
    Downloads a Drive file via its file ID.
    Handles basic cookie confirmation for larger files.
    """
    file_id = extract_drive_id(url)
    if not file_id:
        raise ValueError(f"Could not extract Drive file id from: {url}")

    sess = requests.Session()
    dl_url = drive_direct_download_url(file_id)

    r = sess.get(dl_url, stream=True, timeout=60)
    r.raise_for_status()

    # Google sometimes returns a confirmation page for large files
    # Look for confirm token in cookies
    confirm = None
    for k, v in r.cookies.items():
        if k.startswith("download_warning"):
            confirm = v
            break

    if confirm:
        r = sess.get(dl_url + f"&confirm={confirm}", stream=True, timeout=60)
        r.raise_for_status()

    data = r.content
    # If HTML came back, it's usually permission/login or not found
    if data[:20].lower().startswith(b"<!doctype html") or b"<html" in data[:200].lower():
        raise ValueError(
            "Got HTML instead of image bytes (file may not be public, or Drive blocked it). "
            f"URL: {url}"
        )
    return data

def cloudinary_sign(params: dict) -> str:
    """
    Cloudinary signature:
    sha1( sorted_params_as_querystring + API_SECRET )
    """
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params.keys()))
    raw = (to_sign + API_SECRET).encode("utf-8")
    return hashlib.sha1(raw).hexdigest()

def upload_to_cloudinary(image_bytes: bytes, public_id: str, folder: str) -> str:
    """
    Upload via Cloudinary REST API (no extra packages).
    Returns secure_url.
    """
    timestamp = int(time.time())
    # We set public_id with folder. Cloudinary uses folder in public_id path.
    full_public_id = f"{folder}/{public_id}"

    params = {
        "public_id": full_public_id,
        "timestamp": timestamp,
    }
    signature = cloudinary_sign(params)

    files = {
        "file": ("image.jpg", BytesIO(image_bytes), "application/octet-stream")
    }
    data = {
        "api_key": API_KEY,
        "timestamp": timestamp,
        "public_id": full_public_id,
        "signature": signature,
    }

    endpoint = f"https://api.cloudinary.com/v1_1/{CLOUD_NAME}/image/upload"
    r = requests.post(endpoint, data=data, files=files, timeout=90)
    r.raise_for_status()
    js = r.json()
    return js["secure_url"]

def sanitize_public_id(s: str) -> str:
    # safe-ish public id from product id/name
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9-_]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s[:120] if s else f"img-{int(time.time())}"

def infer_folder(category: str) -> str:
    cat = (category or "").strip().lower()
    if "long" in cat:
        return f"{BASE_FOLDER}/long-dresses"
    if "short" in cat:
        return f"{BASE_FOLDER}/short-dresses"
    return f"{BASE_FOLDER}/other"

def main():
    must_env("SHEET_CSV_URL", SHEET_CSV_URL)
    must_env("CLOUDINARY_CLOUD_NAME", CLOUD_NAME)
    must_env("CLOUDINARY_API_KEY", API_KEY)
    must_env("CLOUDINARY_API_SECRET", API_SECRET)

    print("Fetching sheet CSV...")
    resp = requests.get(SHEET_CSV_URL, timeout=60)
    resp.raise_for_status()

    lines = resp.text.splitlines()
    reader = csv.DictReader(lines)

    rows = list(reader)
    if not rows:
        raise SystemExit("No rows found in CSV. Check your published sheet.")

    # Validate required columns
    required = ["id", "name", "category", "images"]
    for col in required:
        if col not in reader.fieldnames:
            raise SystemExit(f"Missing column in sheet: {col}. Found: {reader.fieldnames}")

    out_fields = reader.fieldnames[:]  # keep same columns
    migrated = 0
    skipped = 0
    failed = 0

    # Cache to avoid re-uploading duplicates
    url_to_cloud = {}

    for i, row in enumerate(rows, start=1):
        img = (row.get("images") or "").strip()
        pid = (row.get("id") or f"row-{i}").strip()
        name = (row.get("name") or "").strip()
        category = (row.get("category") or "").strip()

        if not img:
            skipped += 1
            continue

        # Only migrate first URL if multiple (you can extend later with |)
        first_url = img.split("|")[0].strip()

        # If already a Cloudinary URL, skip
        if "res.cloudinary.com" in first_url:
            skipped += 1
            continue

        if first_url in url_to_cloud:
            row["images"] = url_to_cloud[first_url]
            migrated += 1
            continue

        try:
            # Download from Drive
            data = download_drive_file(first_url)

            # Upload to Cloudinary
            folder = infer_folder(category)
            public_id = sanitize_public_id(pid + "-" + name) if name else sanitize_public_id(pid)
            cloud_url = upload_to_cloudinary(data, public_id=public_id, folder=folder)

            row["images"] = cloud_url
            url_to_cloud[first_url] = cloud_url
            migrated += 1

            print(f"[{i}/{len(rows)}] OK {pid} -> {cloud_url}")
            time.sleep(SLEEP_SECONDS)

        except Exception as e:
            failed += 1
            print(f"[{i}/{len(rows)}] FAIL {pid}: {e}")

    # Write output CSV
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=out_fields)
        writer.writeheader()
        writer.writerows(rows)

    print("\nDONE")
    print(f"Migrated: {migrated}")
    print(f"Skipped:  {skipped}")
    print(f"Failed:   {failed}")
    print(f"Output:   {OUT_CSV}")
    print("\nNext: import products_cloudinary.csv into your Google Sheet (File -> Import).")

if __name__ == "__main__":
    main()
