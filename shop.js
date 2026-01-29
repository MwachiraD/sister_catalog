setBranding();

const statusEl = document.getElementById("status");
const gridEl = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const searchInput = document.getElementById("searchInput");
const categorySelect = document.getElementById("categorySelect");

// Modal elements
const backdrop = document.getElementById("modalBackdrop");
const closeModalBtn = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalImages = document.getElementById("modalImages");
const modalPrice = document.getElementById("modalPrice");
const modalCategory = document.getElementById("modalCategory");
const modalStock = document.getElementById("modalStock");
const modalDesc = document.getElementById("modalDesc");
const modalSize = document.getElementById("modalSize");
const modalOrder = document.getElementById("modalOrder");
const copyTextBtn = document.getElementById("copyText");

let ALL = [];
let CURRENT = null;

function escapeHTML(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function productCard(p){
  const img = firstImage(p);
  const stockClass = p.inStock ? "good" : "bad";
  const stockText = p.inStock ? "In stock" : "Out of stock";
  const price = money(p.price, p.currency);

  return `
  <article class="product" data-id="${escapeHTML(p.id)}">
    <img src="${img}" alt="${escapeHTML(p.name)}" loading="lazy"/>
    <div class="pbody">
      <div class="ptitle">${escapeHTML(p.name)}</div>
      <div class="pmeta">
        <span>${escapeHTML(p.category || "Other")}</span>
        <span class="price">${escapeHTML(price)}</span>
      </div>
      <div class="row between center">
        <span class="pill ${stockClass}">${stockText}</span>
        <span class="muted tiny">${p.sizes?.length ? `Sizes: ${p.sizes.join(", ")}` : ""}</span>
      </div>
      <div class="pactions">
        <button class="btn primary" data-action="view">View</button>
        ${p.inStock ? `<a class="btn whatsapp" target="_blank" rel="noopener"
          href="${waLink(buildOrderMessage(p, p.sizes?.[0] || ""))}">Order</a>` : ""}
      </div>
    </div>
  </article>`;
}

function fillCategories(products){
  const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
  categorySelect.innerHTML = `<option value="">All categories</option>` + cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
}

function applyFilters(){
  const q = safe(searchInput.value).toLowerCase();
  const cat = safe(categorySelect.value);

  const filtered = ALL.filter(p => {
    if(cat && p.category !== cat) return false;
    if(!q) return true;
    const hay = `${p.name} ${p.category} ${p.description} ${p.sizes?.join(" ")}`.toLowerCase();
    return hay.includes(q);
  });

  render(filtered);
}

function render(products){
  if(!products.length){
    gridEl.innerHTML = "";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";
  gridEl.innerHTML = products.map(productCard).join("");
}

function openModal(product){
  CURRENT = product;
  modalTitle.textContent = product.name || "Product";
  modalPrice.textContent = money(product.price, product.currency);
  modalCategory.textContent = product.category || "Other";
  modalDesc.textContent = product.description || "";
  modalStock.textContent = product.inStock ? "In stock" : "Out of stock";
  modalStock.className = "pill " + (product.inStock ? "good" : "bad");

  // sizes
  const sizes = (product.sizes && product.sizes.length) ? product.sizes : ["(select size)"];
  modalSize.innerHTML = sizes.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");

  // images
  const imgs = (product.images && product.images.length) ? product.images : [firstImage(product)];
  modalImages.innerHTML = imgs.map(src => `<img src="${src}" alt="${escapeHTML(product.name)}" loading="lazy" />`).join("");

  updateOrderLink();

  backdrop.style.display = "flex";
}

function closeModal(){
  backdrop.style.display = "none";
  CURRENT = null;
}

function updateOrderLink(){
  if(!CURRENT) return;
  const size = modalSize.value || "";
  const msg = buildOrderMessage(CURRENT, size);
  modalOrder.href = waLink(msg);
  modalOrder.classList.add("whatsapp");
}

gridEl.addEventListener("click", (e) => {
  const card = e.target.closest(".product");
  if(!card) return;
  const id = card.getAttribute("data-id");
  const p = ALL.find(x => x.id === id) || ALL.find(x => x.name === id);
  if(!p) return;

  const action = e.target.getAttribute("data-action");
  if(action === "view"){
    openModal(p);
  }else{
    // click anywhere on card image/title opens modal
    if(e.target.tagName !== "A") openModal(p);
  }
});

closeModalBtn.addEventListener("click", closeModal);
backdrop.addEventListener("click", (e) => { if(e.target === backdrop) closeModal(); });
modalSize.addEventListener("change", updateOrderLink);

copyTextBtn.addEventListener("click", async () => {
  if(!CURRENT) return;
  const msg = buildOrderMessage(CURRENT, modalSize.value || "");
  const ok = await copyToClipboard(msg);
  copyTextBtn.textContent = ok ? "Copied ✓" : "Copy failed";
  setTimeout(() => copyTextBtn.textContent = "Copy order message", 1200);
});

searchInput.addEventListener("input", applyFilters);
categorySelect.addEventListener("change", applyFilters);

(async function init(){
  try{
    statusEl.textContent = "Loading products…";
    ALL = await fetchProducts();
    fillCategories(ALL);
    statusEl.textContent = `Loaded ${ALL.length} products`;
    setTimeout(() => statusEl.textContent = "", 1200);
    applyFilters();
  }catch(err){
    statusEl.textContent = "Failed to load products. Check config.js and Google Sheets publish settings.";
    statusEl.classList.remove("muted");
    statusEl.style.color = "rgba(255,165,160,1)";
  }
})();
