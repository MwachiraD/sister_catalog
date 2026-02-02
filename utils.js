// utils.js

function setBranding(){
  const brand = (typeof SHOP_NAME !== "undefined" && SHOP_NAME) ? SHOP_NAME : "Shop";
  document.querySelectorAll("#brandName").forEach(el => el.textContent = brand);

  const footerName = document.getElementById("footerShopName");
  if(footerName) footerName.textContent = brand;

  const y = document.getElementById("year");
  if(y) y.textContent = new Date().getFullYear();

  // Better browser tab titles + OG tags
  const title = document.title || "";
  const lowerTitle = title.toLowerCase();
  if(title){
    const hasSeparator = title.includes(" - ");
    const hasTemplate = lowerTitle.includes("sister whatsapp catalog") || lowerTitle.includes("whatsapp catalog");
    if(hasSeparator || hasTemplate){
      let base = title;
      if(title.includes(" - ")) base = title.split(" - ")[0];
      base = base.trim();
      if(base && base.toLowerCase() !== brand.toLowerCase()){
        document.title = `${base} - ${brand}`;
      }else{
        document.title = brand;
      }
    }
  }else{
    document.title = brand;
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if(ogTitle) ogTitle.setAttribute("content", brand);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if(ogDesc){
    ogDesc.setAttribute("content", `Browse ${brand} products and order on WhatsApp.`);
  }

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if(ogUrl){
    const origin = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "";
    const url = origin ? `${origin}${baseUrl("/index.html")}` : baseUrl("/index.html");
    ogUrl.setAttribute("content", url);
  }

  const ogImage = document.querySelector('meta[property="og:image"]');
  if(ogImage){
    const current = ogImage.getAttribute("content") || "";
    const fallback = `https://dummyimage.com/1200x630/0b0f17/e9eefc.png&text=${encodeURIComponent(brand)}`;
    if(!current || current.includes("dummyimage.com")){
      ogImage.setAttribute("content", fallback);
    }
  }
}

function safe(v){
  return (v ?? "").toString().trim();
}

function normalizeHeader(h){
  // Fixes: "id " -> "id", "in stock" -> "in_stock", "currency " -> "currency"
  return safe(h).toLowerCase().replace(/\s+/g, "_");
}

function toBool(v){
  const s = safe(v).toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

function parsePipes(v){
  const s = safe(v);
  if(!s) return [];
  return s.split("|").map(x => x.trim()).filter(Boolean);
}

function money(price, currency){
  const p = safe(price);
  const c = safe(currency) || (typeof CURRENCY_FALLBACK !== "undefined" ? CURRENCY_FALLBACK : "");
  return c ? `${c} ${p}` : p;
}

function waLink(message){
  const num = (typeof WHATSAPP_NUMBER !== "undefined" ? WHATSAPP_NUMBER : "").replace(/\D/g,"");
  const text = encodeURIComponent(message);
  return `https://wa.me/${num}?text=${text}`;
}

function baseUrl(path){
  const b = (typeof BASE_PATH !== "undefined" ? BASE_PATH : "");
  return `${b}${path}`;
}

/**
 * Fetch CSV from Google Sheets and parse.
 * Returns an array of product objects.
 */
async function fetchProducts(){
  if(!SHEET_CSV_URL || SHEET_CSV_URL.includes("PASTE_YOUR")) {
    throw new Error("Missing SHEET_CSV_URL in config.js");
  }

  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if(!res.ok) throw new Error(`Failed to fetch sheet CSV: ${res.status}`);

  const csvText = await res.text();
  return parseCSV(csvText);
}

// Robust-ish CSV parser (handles quoted fields)
function parseCSV(text){
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for(let i=0; i<text.length; i++){
    const ch = text[i];
    const next = text[i+1];

    if(ch === '"'){
      if(inQuotes && next === '"'){ // escaped quote
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if(!inQuotes && ch === ','){
      row.push(cur);
      cur = "";
      continue;
    }

    if(!inQuotes && (ch === '\n' || ch === '\r')){
      if(ch === '\r' && next === '\n'){ i++; }
      row.push(cur);
      cur = "";
      if(row.some(cell => safe(cell) !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  // last row
  if(cur.length || row.length){
    row.push(cur);
    if(row.some(cell => safe(cell) !== "")) rows.push(row);
  }

  if(rows.length < 2) return [];

  // ✅ Normalize headers so trailing spaces and "in stock" don't break the app
  const header = rows[0].map(normalizeHeader);

  const out = [];
  for(let r=1; r<rows.length; r++){
    const obj = {};
    for(let c=0; c<header.length; c++){
      obj[header[c]] = rows[r][c] ?? "";
    }

    // ✅ Normalized header means we can rely on in_stock now
    const inStockVal = obj.in_stock;

    out.push({
      id: safe(obj.id),
      name: safe(obj.name),
      price: safe(obj.price),
      currency: safe(obj.currency),
      category: safe(obj.category),
      sizes: parsePipes(obj.sizes),
      images: parsePipes(obj.images),
      description: safe(obj.description),

      // Keep your existing shape: inStock + featured
      inStock: toBool(inStockVal),
      featured: toBool(obj.featured),
    });
  }

  // remove empty names
  return out.filter(p => p.name);
}

function firstImage(product){
  if(product.images && product.images.length && product.images[0]) return product.images[0];

  // fallback placeholder (simple gradient SVG)
  const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#1f6feb" offset="0"/><stop stop-color="#2ea043" offset="1"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial" font-size="42" fill="white" opacity="0.92">${safe(product.name).slice(0,22)}</text>
  </svg>`);
  return `data:image/svg+xml,${svg}`;
}

function buildOrderMessage(product, size){
  const sizeTxt = size ? `Size: ${size}` : "Size: (tell us your size)";
  return [
    `Hi ${SHOP_NAME || "Tabz Collection"}! I want to order:`,
    ``,
    `Item: ${product.name}`,
    `ID: ${product.id}`,
    `Price: ${money(product.price, product.currency)}`,
    sizeTxt,
    ``,
    `Delivery location: (your location)`,
    `Delivery method: (rider/parcel)`,
    `Payment: (Mpesa/cash)`,
  ].join("\n");
}

async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch(e){
    return false;
  }
}
