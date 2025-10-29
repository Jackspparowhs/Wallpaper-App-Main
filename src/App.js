import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { IoSearch } from "react-icons/io5";
import { FaMoon, FaSun, FaHeart, FaDownload, FaBars, FaTimes } from "react-icons/fa";
import { BsGlobeCentralSouthAsia } from "react-icons/bs";
import "./App.css";
import { Helmet } from "react-helmet";

/**
 * Notes:
 * - Default theme is light on fresh installs.
 * - Photo/video modal opens when clicking a card (shows details + big download).
 * - Sidebar scrolls and has a "More categories" collapse.
 * - Photo/Video filter toggles available in header.
 * - Minimal URL routing added: /search/<term>
 */

function App() {
  const API_KEY = "ndFZWMqcwlbe4uaEQAjp48nuA7t17Agu18kaGyieUpXK5UIDUEqsGVvl";
  const CACHE_DURATION = useMemo(() => 1000 * 60 * 60, []); // 1 hour cache

  // Categories: primary shown first, many hidden inside "more"
  const PRIMARY_CATEGORIES = ["Nature", "Space", "Forest", "Travel", "Animals", "Food"];
  const MORE_CATEGORIES = [
    "Technology",
    "Cars",
    "People",
    "Architecture",
    "City",
    "Beaches",
    "Mountains",
    "Abstract",
    "Business",
    "Fitness",
    "Night",
    "Macro",
    "Sports",
  ];

  const ALL_CATEGORIES = [...PRIMARY_CATEGORIES, ...MORE_CATEGORIES];

  // state
  const [media, setMedia] = useState([]);
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem("favorites") || "[]"));
  const [favoriteCount, setFavoriteCount] = useState(favorites.length);
  const [pageIndex, setPageIndex] = useState(1);
  const [searchValueGlobal, setSearchValueGlobal] = useState("");
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showPreloader, setShowPreloader] = useState(false); // keep small; hidden by default
  const [showFavorites, setShowFavorites] = useState(false);
  const [suggestions, setSuggestions] = useState(() => JSON.parse(localStorage.getItem("recentSearches") || '["Nature","Space","Travel","Animals"]'));
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMoreCats, setShowMoreCats] = useState(false);
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'photos' | 'videos'
  const [modalItem, setModalItem] = useState(null);
  const [randomizeOnLoad] = useState(true);

  const loader = useRef(null);

  // helper: shuffle array
  const shuffleArray = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // --- URL routing helpers (minimal, no react-router) ---
  const getTermFromPath = () => {
    try {
      const m = window.location.pathname.match(/^\/search\/(.+)$/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) {
      return null;
    }
  };

  const pushSearchToUrl = (term) => {
    try {
      const newPath = `/search/${encodeURIComponent(term)}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState({}, "", newPath);
      }
    } catch (e) {
      // ignore
    }
  };

  // --- fetch helpers ---
  const fetchData = useCallback(async (url) => {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", Authorization: API_KEY },
      });
      return await r.json();
    } catch (e) {
      console.error("Fetch error", e);
      return { photos: [], videos: [] };
    }
  }, [API_KEY]);

  const fetchPhotosAndVideos = useCallback(async (query, page = 1) => {
    const photoURL = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=12`;
    const videoURL = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&page=${page}&per_page=6`;

    const [photoData, videoData] = await Promise.all([fetchData(photoURL), fetchData(videoURL)]);
    const photos = (photoData.photos || []).map((p) => ({
      id: `photo-${p.id}`,
      type: "photo",
      photographer: p.photographer,
      src: p.src,
      alt: p.alt || "",
    }));
    const videos = (videoData.videos || []).map((v) => ({
      id: `video-${v.id}`,
      type: "video",
      photographer: v.user?.name || "Unknown",
      src: {
        large: v.video_pictures?.[0]?.picture || "",
        original: v.video_files?.find((f) => f.quality === "hd")?.link || v.video_files?.[0]?.link || "",
      },
      alt: v.description || "",
    }));
    // return photos then videos but shuffled
    return shuffleArray([...photos, ...videos]);
  }, [fetchData]);

  // --- get media and manage state ---
  const getSearchedMedia = useCallback(async (searchValue, index = 1, isAppending = false) => {
    if (!searchValue) return;
    setLoading(true);
    setNoResults(false);
    try {
      const results = await fetchPhotosAndVideos(searchValue, index);

      if (results.length === 0) {
        setNoResults(true);
        setHasMore(false);
      } else setHasMore(true);

      setMedia(prev => isAppending ? [...new Map([...prev, ...results].map(m => [m.id, m])).values()] : results);
    } catch (e) {
      console.error("getSearchedMedia error", e);
      setNoResults(true);
    } finally {
      setLoading(false);
    }
  }, [fetchPhotosAndVideos]);

  // initial load (prefer nature/space/forest) — check URL first
  useEffect(() => {
    setShowPreloader(false);
    const termFromPath = getTermFromPath();
    if (termFromPath) {
      setSearchValueGlobal(termFromPath);
      setPageIndex(1);
      getSearchedMedia(termFromPath, 1);
      return;
    }
    const initialCats = ["Nature", "Space", "Forest"];
    const pick = initialCats[randInt(0, initialCats.length - 1)];
    const page = randomizeOnLoad ? randInt(1, 5) : 1;
    setSearchValueGlobal(pick);
    setTimeout(() => getSearchedMedia(pick, page), 150); // small delay so UI mounts first
  }, [getSearchedMedia, randomizeOnLoad]);

  // React to browser back/forward
  useEffect(() => {
    const onPop = () => {
      const term = getTermFromPath();
      if (term) {
        setSearchValueGlobal(term);
        setPageIndex(1);
        getSearchedMedia(term, 1);
      } else {
        // optional: fallback to default category when no /search/ path
        const q = "Nature";
        setSearchValueGlobal(q);
        setPageIndex(1);
        getSearchedMedia(q, 1);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [getSearchedMedia]);

  // infinite scroll
  const handleObserver = useCallback((entries) => {
    const target = entries[0];
    if (target.isIntersecting && !loading && hasMore) {
      const nextPage = pageIndex + 1;
      const query = searchValueGlobal || PRIMARY_CATEGORIES[0];
      getSearchedMedia(query, nextPage, true);
      setPageIndex(nextPage);
    }
  }, [loading, hasMore, pageIndex, getSearchedMedia, searchValueGlobal]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, { root: null, rootMargin: "200px", threshold: 0 });
    const cur = loader.current;
    if (cur) observer.observe(cur);
    return () => { if (cur) observer.unobserve(cur); };
  }, [handleObserver]);

  // theme persistence
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");

  // favorites handling
  const toggleFavorite = useCallback((e, item) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setFavorites(prev => {
      const exists = prev.some(f => f.id === item.id);
      const updated = exists ? prev.filter(f => f.id !== item.id) : [item, ...prev];
      localStorage.setItem("favorites", JSON.stringify(updated));
      setFavoriteCount(updated.length);
      return updated;
    });
  }, []);

  const isFavorited = useCallback((id) => favorites.some(f => f.id === id), [favorites]);

  // download without showing global loader
  const handleDownload = useCallback(async (e, url, name) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!url) return alert("Download url not available.");
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = (url.split(".").pop().split("?")[0] || "jpg").slice(0, 4);
      a.download = `${name || "media"}-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("download failed", err);
      alert("Download failed.");
    }
  }, []);

  // render media grid items
  const RenderMedia = useCallback((items) => {
    // filter by filterMode
    const filtered = items.filter(it => filterMode === "all" ? true : (filterMode === "photos" ? it.type === "photo" : it.type === "video"));
    return filtered.map(item => (
      <div className="item" key={item.id} onClick={() => setModalItem(item)} role="button" tabIndex={0}>
        {item.type === "photo" ? (
          <img src={item.src.large} alt={item.alt || item.photographer} loading="lazy" />
        ) : (
          <div className="video-wrapper">
            <video className="video-item" poster={item.src.large} preload="metadata" muted>
              <source src={item.src.original} type="video/mp4" />
            </video>
          </div>
        )}

        {/* photographer text hidden by default, visible in modal */}
        <div className="item-actions">
          <button className="icon small" title="Download" onClick={(e) => { e.stopPropagation(); handleDownload(e, item.type === "photo" ? item.src.original || item.src.large : item.src.original, item.photographer); }}>
            <FaDownload />
          </button>

          <button className={`icon small heart ${isFavorited(item.id) ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(e, item); }}>
            <FaHeart />
          </button>
        </div>
      </div>
    ));
  }, [filterMode, handleDownload, isFavorited, toggleFavorite]);

  // helper used by categories & pills — opens category and pushes URL
  const openCategory = useCallback((cat) => {
    if (!cat) return;
    pushSearchToUrl(cat);
    setSearchValueGlobal(cat);
    setPageIndex(1);
    setShowFavorites(false);
    getSearchedMedia(cat, randInt(1,5));
    setSidebarOpen(false);
  }, [getSearchedMedia]);

  // search handling (updated: push URL)
  const handleSearch = (e) => {
    e.preventDefault();
    const q = e.target.querySelector("input").value.trim();
    if (!q) return;
    pushSearchToUrl(q);
    setSearchValueGlobal(q);
    setPageIndex(1);
    setShowFavorites(false);
    getSearchedMedia(q, randInt(1, 5));
    setSuggestions(prev => { const updated = [q, ...prev.filter(s => s !== q)].slice(0, 8); localStorage.setItem("recentSearches", JSON.stringify(updated)); return updated; });
    e.target.querySelector("input").value = "";
    setSidebarOpen(false);
  };

  // modal close
  const closeModal = () => setModalItem(null);

  // quick clear cache
  const clearCache = () => {
    Object.keys(localStorage).forEach(k => {
      if (!["favorites", "theme", "recentSearches"].includes(k)) localStorage.removeItem(k);
    });
    alert("Cache cleared (favorites & theme preserved).");
  };

  // encode URL for og:url
  const ogUrl = `https://stock.pirateruler.com/search/${encodeURIComponent(searchValueGlobal || "home")}`;

  return (
    <>
      {/* SEO / Open Graph meta tags via Helmet */}
      <Helmet>
        <title>
          {searchValueGlobal
            ? `${searchValueGlobal} Free Stock Photos & Videos | PirateRuler`
            : "Free Stock Photos & Videos | PirateRuler"}
        </title>
        <meta
          name="description"
          content={
            searchValueGlobal
              ? `Download high-quality ${searchValueGlobal} stock photos and videos — free and royalty-free from PirateRuler.`
              : "Download millions of free stock photos & videos. Explore Nature, Space, Travel, Japan and more on PirateRuler."
          }
        />
        <meta name="keywords" content={`${searchValueGlobal}, stock photos, stock videos, free downloads, PirateRuler`} />
        <meta property="og:title" content={`Stock photos & videos: ${searchValueGlobal || "PirateRuler"}`} />
        <meta property="og:description" content="Free stock photos & videos by PirateRuler — download and use anywhere!" />
        <meta property="og:image" content="%PUBLIC_URL%/logo512.png" />
        <meta property="og:url" content={ogUrl} />
      </Helmet>

      {/* Sidebar overlay */}
      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-hidden={!sidebarOpen}>
        <div className="sidebar-inner">
          <div className="sidebar-top">
            <div className="sidebar-title">
              <h2>PirateRuler</h2>
              <button className="close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><FaTimes /></button>
            </div>
            <p className="sidebar-desc">Download photos & videos · 10M+ collection</p>
          </div>

          <nav className="sidebar-nav">
            <div className="cat-grid">
              {PRIMARY_CATEGORIES.map(cat => (
                <button key={cat} className="nav-item" onClick={() => openCategory(cat)}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="more-block">
              <button className="more-toggle" onClick={() => setShowMoreCats(s => !s)}>{showMoreCats ? "Hide categories ▲" : "Show more categories ▼"}</button>
              {showMoreCats && (
                <div className="more-list">
                  {MORE_CATEGORIES.map(cat => (
                    <button key={cat} className="nav-item" onClick={() => openCategory(cat)}>
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <a href="https://pirateruler.com" target="_blank" rel="noreferrer" className="pirateruler-link">PirateRuler.com</a>

<hr style={{ margin: "12px 0", borderColor: "#444" }} />

<div className="sidebar-legal">
  <h4 style={{ marginBottom: "8px" }}>Info & Legal</h4>
  <p style={{ fontSize: "13px", color: "#aaa", lineHeight: "1.5" }}>
    <strong>About:</strong> PirateRuler provides free stock photos and videos powered by the Pexels API.
    All content is royalty-free and safe for personal or commercial use.
  </p>
  <p style={{ fontSize: "13px", color: "#aaa", marginTop: "8px" }}>
    <strong>Privacy Policy:</strong> We do not collect or store user data. Third-party APIs may use cookies for analytics.
  </p>
  <p style={{ fontSize: "13px", color: "#aaa", marginTop: "8px" }}>
    <strong>Disclaimer:</strong> All media are fetched from Pexels under their license. PirateRuler does not own or host copyrighted content.
  </p>
</div>
          </nav>

          <div className="sidebar-controls">
            <div className="control-row">
              <button className="theme-btn" onClick={toggleTheme}>{theme === "light" ? <FaMoon /> : <FaSun />} &nbsp; {theme === "light" ? "Dark" : "Light"}</button>
              <button className="fav-btn" onClick={() => { setShowFavorites(true); setSidebarOpen(false); }}>{/* show favorites */}<FaHeart /> &nbsp; Favorites <span className="fav-count">{favoriteCount}</span></button>
            </div>

            <div className="control-row">
              <button className="cache-btn" onClick={clearCache}>Clear cache</button>
            </div>
          </div>

          <div className="sidebar-footer">
            <small>© {new Date().getFullYear()} PirateRuler</small>
          </div>
        </div>
      </aside>

      {/* header + main */}
      <header className="header">
        <div className="left">
          <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><FaBars /></button>
          <h1 className="brand" onClick={() => { setShowFavorites(false); const q = "Nature"; setSearchValueGlobal(q); pushSearchToUrl(q); getSearchedMedia(q, randInt(1,5)); }}>
            Stocks by <a href="https://pirateruler.com" target="_blank" rel="noreferrer">PirateRuler.com</a>
          </h1>
        </div>

        <div className="center">
          <form onSubmit={handleSearch} className="search-form" role="search">
            <input name="q" aria-label="Search photos or videos" placeholder="Search photos or videos..." />
            <button type="submit" className="search-btn" aria-label="Search"><IoSearch /></button>
          </form>

          <div className="filter-row">
            <button className={`filter-btn ${filterMode === "all" ? "active" : ""}`} onClick={() => setFilterMode("all")}>All</button>
            <button className={`filter-btn ${filterMode === "photos" ? "active" : ""}`} onClick={() => setFilterMode("photos")}>Photos</button>
            <button className={`filter-btn ${filterMode === "videos" ? "active" : ""}`} onClick={() => setFilterMode("videos")}>Videos</button>
          </div>
        </div>

        {/* Right header icons removed - favorites & theme are only in sidebar now */}
      </header>

      {/* hero */}
      <section className="hero">
        <div className="hero-inner">
          <h2>Download stock photos & videos</h2>
          <p className="hero-desc">Over 20M+ free stock photos & videos (via Pexels & Pixabay). Search, preview and download — fresh results each visit.</p>

          <div className="hero-ctas">
            <button className="cta primary" onClick={() => openCategory("Nature")}>Explore Popular</button>
            <button className="cta" onClick={() => openCategory("Trending")}>Trending</button>
          </div>

          <div className="hero-pills">
            {PRIMARY_CATEGORIES.map(cat => <button key={cat} className="pill" onClick={() => openCategory(cat)}>{cat}</button>)}
          </div>
        </div>
      </section>

      {/* gallery */}
      <main className="main-content">
        <div className="container">
          <div className="gallery">
            {noResults ? <div className="no-results">No media found for your search.</div>
              : showFavorites ? (favorites.length > 0 ? RenderMedia(favorites) : <div className="no-results">No favorites yet — try exploring!</div>)
              : RenderMedia(media)
            }
          </div>

          <div ref={loader} style={{ height: 10 }} />

          {loading && <div className="loading"><BsGlobeCentralSouthAsia /> Loading...</div>}
        </div>
      </main>

      {/* footer */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>Powered by PirateRuler</div>
          <div className="footer-links"><a href="https://pirateruler.com">Main</a> • <a href="https://pexels.com">Pexels</a></div>
        </div>
      </footer>

      {/* modal */}
      {modalItem && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-inner">
            <button className="modal-close" onClick={closeModal}><FaTimes /></button>
            <div className="modal-media">
              {modalItem.type === "photo" ? (
                <img src={modalItem.src.original || modalItem.src.large} alt={modalItem.alt || modalItem.photographer} />
              ) : (
                <video controls autoPlay>
                  <source src={modalItem.src.original} type="video/mp4" />
                </video>
              )}
            </div>

            <div className="modal-info">
              <h3>{modalItem.photographer}</h3>
              {modalItem.alt && <p className="modal-desc">{modalItem.alt}</p>}

              <div className="modal-actions">
                <button className="cta" onClick={(e) => handleDownload(e, modalItem.type === "photo" ? (modalItem.src.original || modalItem.src.large) : modalItem.src.original, modalItem.photographer)}>Download</button>
                <button className={`heart ${isFavorited(modalItem.id) ? "active" : ""}`} onClick={(e) => toggleFavorite(e, modalItem)}><FaHeart /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
