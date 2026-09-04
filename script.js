const API = "https://api.jikan.moe/v4";

// --- tiny helper: Jikan rate-limits to ~3 req/sec, so queue calls ---
let lastCall = 0;
async function jikan(path){
  const wait = Math.max(0, 400 - (Date.now() - lastCall));
  if(wait) await new Promise(r => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(`${API}${path}`);
  if(!res.ok) throw new Error(`Jikan error ${res.status}`);
  return res.json();
}

const heroEl = document.getElementById("hero");
const seasonGrid = document.getElementById("seasonGrid");
const topGrid = document.getElementById("topGrid");
const searchSection = document.getElementById("searchResults");
const searchGrid = document.getElementById("searchGrid");
const searchTermLabel = document.getElementById("searchTermLabel");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");

let heroList = [];
let heroIndex = 0;

function skeletonCards(n){
  return Array.from({length:n}).map(() => {
    const d = document.createElement("div");
    d.className = "skeleton-card";
    return d;
  });
}

function renderGrid(container, items){
  container.innerHTML = "";
  items.forEach(anime => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${anime.images?.jpg?.image_url || ""}" alt="${escapeHtml(anime.title)}" loading="lazy">
      <div class="card-body">
        <div class="card-title">${escapeHtml(anime.title)}</div>
        <div class="card-meta">
          <span class="score">${anime.score ? "★ " + anime.score : "—"}</span>
          <span>${anime.type || ""}${anime.episodes ? " · " + anime.episodes + "ep" : ""}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openModal(anime));
    container.appendChild(card);
  });
}

function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function openModal(anime){
  modalBody.innerHTML = `
    <div class="modal-hero">
      <img src="${anime.images?.jpg?.image_url || ""}" alt="${escapeHtml(anime.title)}">
      <div>
        <h3>${escapeHtml(anime.title)}</h3>
        <div class="modal-tags">
          ${(anime.genres || []).slice(0,4).map(g => `<span class="tag">${escapeHtml(g.name)}</span>`).join("")}
        </div>
        <div class="card-meta">
          <span class="score">${anime.score ? "★ " + anime.score : "Unrated"}</span>
          <span>${anime.status || ""}</span>
        </div>
      </div>
    </div>
    <p class="modal-synopsis">${escapeHtml(anime.synopsis) || "No synopsis available."}</p>
    <div class="modal-actions">
      <a class="modal-link" href="${anime.url}" target="_blank" rel="noopener">View on MyAnimeList →</a>
      ${anime.trailer?.youtube_id ? `<button class="modal-link wp-open-btn" id="wpOpenBtn">Watch trailer together →</button>` : ""}
    </div>
  `;
  modal.hidden = false;

  if(anime.trailer?.youtube_id){
    document.getElementById("wpOpenBtn").addEventListener("click", () => {
      modal.hidden = true;
      window.openWatchParty(anime.trailer.youtube_id, anime.title);
    });
  }
}

document.getElementById("modalClose").addEventListener("click", () => modal.hidden = true);
modal.addEventListener("click", e => { if(e.target === modal) modal.hidden = true; });

function setHero(anime){
  heroEl.style.backgroundImage = `url(${anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || ""})`;
  heroEl.innerHTML = `
    <div class="hero-content">
      <div class="hero-eyebrow">Airing this season</div>
      <h1 class="hero-title">${escapeHtml(anime.title)}</h1>
      <p class="hero-synopsis">${escapeHtml(anime.synopsis) || ""}</p>
      <button class="hero-cta" id="heroCta">More info</button>
    </div>
  `;
  document.getElementById("heroCta").addEventListener("click", () => openModal(anime));
}

async function init(){
  seasonGrid.append(...skeletonCards(6));
  topGrid.append(...skeletonCards(6));

  try{
    const season = await jikan("/seasons/now?limit=12");
    const seasonList = season.data || [];
    renderGrid(seasonGrid, seasonList);

    heroList = seasonList.filter(a => a.images?.jpg?.large_image_url).slice(0, 5);
    if(heroList.length){
      setHero(heroList[0]);
      setInterval(() => {
        heroIndex = (heroIndex + 1) % heroList.length;
        setHero(heroList[heroIndex]);
      }, 8000);
    }
  }catch(e){
    seasonGrid.innerHTML = `<p style="color:var(--muted)">Couldn't load this season's anime right now — try refreshing.</p>`;
  }

  try{
    const top = await jikan("/top/anime?limit=12");
    renderGrid(topGrid, top.data || []);
  }catch(e){
    topGrid.innerHTML = `<p style="color:var(--muted)">Couldn't load the top-rated list right now — try refreshing.</p>`;
  }
}

document.getElementById("searchForm").addEventListener("submit", async e => {
  e.preventDefault();
  const q = document.getElementById("searchInput").value.trim();
  if(!q) return;

  searchSection.hidden = false;
  searchTermLabel.textContent = `"${q}"`;
  searchGrid.innerHTML = "";
  searchGrid.append(...skeletonCards(6));
  searchSection.scrollIntoView({behavior:"smooth", block:"start"});

  try{
    const results = await jikan(`/anime?q=${encodeURIComponent(q)}&limit=12&sfw=true`);
    const items = results.data || [];
    if(items.length){
      renderGrid(searchGrid, items);
    }else{
      searchGrid.innerHTML = `<p style="color:var(--muted)">No results for "${escapeHtml(q)}".</p>`;
    }
  }catch(err){
    searchGrid.innerHTML = `<p style="color:var(--muted)">Search failed — try again in a moment.</p>`;
  }
});

init();
