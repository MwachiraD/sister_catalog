setBranding();

const waBtn = document.getElementById("whatsappBtn");
if(waBtn){
  waBtn.href = waLink(`Hi ${SHOP_NAME || ""}! I want to ask about your products.`);
}

const featuredGrid = document.getElementById("featuredGrid");
const featuredEmpty = document.getElementById("featuredEmpty");

(async function(){
  if(!featuredGrid) return;
  try{
    const products = await fetchProducts();
    const hasRealImage = (p) => p.images && p.images.length && /^https?:\/\//.test(p.images[0]);
    const featured = products.filter(p => p.featured && p.inStock && hasRealImage(p)).slice(0, 8);
    const fallback = products.filter(p => p.inStock && hasRealImage(p)).slice(0, 8);
    const display = featured.length ? featured : fallback;
    if(!display.length){
      featuredEmpty.style.display = "block";
      featuredEmpty.textContent = "New items coming soon—chat on WhatsApp.";
      return;
    }
    featuredGrid.innerHTML = display.map(p => productCardHTML(p, true)).join("");
    wireCardClicks(featuredGrid, display);
  }catch(err){
    featuredEmpty.style.display = "block";
    featuredEmpty.textContent = "Could not load featured products. Check config.js + Sheet publish settings.";
  }
})();

function productCardHTML(p, compact=false){
  const img = firstImage(p);
  const stockClass = p.inStock ? "good" : "bad";
  const stockText = p.inStock ? "In stock" : "Out of stock";
  const price = money(p.price, p.currency);
  return `
  <article class="product" data-id="${p.id}">
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
        <a class="btn primary" href="${baseUrl("/shop.html")}" aria-label="View in shop">View</a>
        ${p.inStock ? `<a class="btn whatsapp" target="_blank" rel="noopener"
           href="${waLink(buildOrderMessage(p, p.sizes?.[0] || ""))}">Order</a>` : ""}
      </div>
    </div>
  </article>`;
}

function wireCardClicks(container, products){
  container.querySelectorAll(".product").forEach(card => {
    const id = card.getAttribute("data-id");
    const p = products.find(x => x.id === id) || products.find(x => x.name === id);
    // no modal on home; clicking image/title goes to shop
    card.addEventListener("click", (e) => {
      const t = e.target;
      if(t && (t.tagName === "A" || t.tagName === "BUTTON")) return;
      window.location.href = baseUrl("/shop.html");
    });
  });
}

function escapeHTML(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}
