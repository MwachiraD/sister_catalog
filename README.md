# Sister WhatsApp Catalog (Free) — Google Sheets → Website → WhatsApp Orders

This is a **static website** you can host for free (GitHub Pages / Netlify / Vercel).
Products are stored in **Google Sheets**. The website fetches the sheet as **CSV** and renders a catalog.
Each product has an **Order on WhatsApp** button (prefilled message).

## 1) What you get
- Mobile-friendly catalog
- Search + category filter
- Product details modal
- WhatsApp order links (no paid WhatsApp API needed)
- "How to order", Delivery/Payment info pages

---

## 2) Google Sheets setup (the “free backend”)

### Step A — Create a sheet
Create a Google Sheet with a tab named: `products`

### Step B — Add the header row (Row 1)
Copy/paste this header row into Row 1:

id,name,price,currency,category,sizes,images,description,in_stock,featured

### Step C — Add products (example row)
Example:

001,Black Dress,1800,KES,Dresses,S|M|L,https://example.com/img1.jpg|https://example.com/img2.jpg,Soft fit black dress,TRUE,TRUE

**Notes**
- `sizes`: separate sizes with `|`
- `images`: paste **image URLs** separated by `|`
  - easiest: upload photos to Google Drive, set them public, and use shareable direct links
  - or use any public image hosting later
- `in_stock`: TRUE / FALSE
- `featured`: TRUE / FALSE (optional)

---

## 3) Publish sheet to the web (important!)
In Google Sheets:
1. **File → Share → Publish to the web**
2. Choose:
   - **Sheet:** `products`
   - **Format:** `Comma-separated values (.csv)`
3. Click **Publish**
4. Copy the published link (it will contain `pub?output=csv`)

You will paste that link into `config.js` as `SHEET_CSV_URL`.

---

## 4) Configure WhatsApp number + sheet URL
Open `config.js` and edit:

- `WHATSAPP_NUMBER`: use international format, **no plus sign**
  - Example Kenya: `254712345678`
- `SHEET_CSV_URL`: paste your published CSV URL
- `SHOP_NAME`: your sister’s brand name

---

## 5) Run locally (VS Code)
This is a static site, so you can run it with VS Code “Live Server”:

1. Open this folder in VS Code
2. Install extension: **Live Server**
3. Right-click `index.html` → **Open with Live Server**

---

## 6) Free hosting options (pick one)

### Option A — GitHub Pages (Free)
1. Create a GitHub repo
2. Upload all files
3. Repo Settings → Pages → Deploy from branch → `main` / root
4. Your site becomes: `https://<username>.github.io/<repo>/`

### Option B — Netlify (Free)
1. Drag-and-drop the folder into Netlify
2. Done

### Option C — Vercel (Free)
Works too, but GitHub Pages/Netlify is simplest for static.

---

## 7) Troubleshooting
- If products don’t appear:
  - ensure the sheet is **published**
  - ensure the tab name is **products**
  - ensure `SHEET_CSV_URL` is correct
- If images don’t show:
  - links must be public and direct
  - try hosting images on a public CDN later

---

## 8) Next upgrades (still free)
- Add an “Order Form” that creates a WhatsApp message including:
  - name, location, delivery option
- Add “New arrivals” page (filter by latest IDs)
- Add “Collections” (more categories)
- Add basic analytics (Google Analytics / Plausible free tier)

Enjoy.
