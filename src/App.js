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

/**
 * ✅ Normal footer version (not sticky)
 * ✅ Keeps About, Privacy, Contact, Terms links
 * ✅ Works perfectly for all sites
 */

function App() {
  const API_KEY = "ndFZWMqcwlbe4uaEQAjp48nuA7t17Agu18kaGyieUpXK5UIDUEqsGVvl";
  const CACHE_DURATION = useMemo(() => 1000 * 60 * 60, []); // 1 hour

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

  const [media, setMedia] = useState([]);
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem("favorites") || "[]"));
  const [favoriteCount, setFavoriteCount] = useState(favorites.length);
  const [pageIndex, setPageIndex] = useState(1);
  const [searchValueGlobal, setSearchValueGlobal] = useState("");
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showFavorites, setShowFavorites] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMoreCats, setShowMoreCats] = useState(false);
  const [filterMode, setFilterMode] = useState("all");
  const [modalItem, setModalItem] = useState(null);

  const loader = useRef(null);

  // Shuffle helper
  const shuffleArray = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // fetch from Pexels
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
      original: p.src.original || p.src.large,
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
    return shuffleArray([...photos, ...videos]);
  }, [fetchData]);

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

  // Initial load
  useEffect(() => {
    const initialCats = ["Nature", "Space", "Forest"];
    const pick = initialCats[randInt(0, initialCats.length - 1)];
    setSearchValueGlobal(pick);
    getSearchedMedia(pick, randInt(1, 3));
  }, [getSearchedMedia]);

  // Infinite scroll
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

  // Theme toggle
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");

  const toggleFavorite = (e, item) => {
    e.stopPropagation();
    setFavorites(prev => {
      const exists = prev.some(f => f.id === item.id);
      const updated = exists ? prev.filter(f => f.id !== item.id) : [item, ...prev];
      localStorage.setItem("favorites", JSON.stringify(updated));
      setFavoriteCount(updated.length);
      return updated;
    });
  };

  const handleDownload = async (e, url, name) => {
    e.stopPropagation();
    if (!url) return alert("No download link");
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${name}-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const RenderMedia = (items) => {
    const filtered = items.filter(it => filterMode === "all" ? true : (filterMode === "photos" ? it.type === "photo" : it.type === "video"));
    return filtered.map(item => (
      <div className="item" key={item.id} onClick={() => setModalItem(item)}>
        {item.type === "photo" ? (
          <img src={item.src.large} alt={item.alt} loading="lazy" />
        ) : (
          <video className="video-item" poster={item.src.large} muted>
            <source src={item.src.original} type="video/mp4" />
          </video>
        )}
        <div className="item-actions">
          <button className="icon small" title="Download" onClick={(e) => handleDownload(e, item.src.original, item.photographer)}><FaDownload /></button>
          <button className="icon small heart" onClick={(e) => toggleFavorite(e, item)}><FaHeart /></button>
        </div>
      </div>
    ));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = e.target.querySelector("input").value.trim();
    if (!q) return;
    setSearchValueGlobal(q);
    getSearchedMedia(q);
    e.target.querySelector("input").value = "";
    setSidebarOpen(false);
  };

  return (
    <>
      {/* Sidebar Overlay */}
      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-inner">
          <div className="sidebar-top">
            <h2>PirateRuler</h2>
            <button className="close-btn" onClick={() => setSidebarOpen(false)}><FaTimes /></button>
          </div>

          <nav className="sidebar-nav">
            {PRIMARY_CATEGORIES.map(cat => (
              <button key={cat} className="nav-item" onClick={() => getSearchedMedia(cat)}>{cat}</button>
            ))}

            <div className="more-block">
              <button className="more-toggle" onClick={() => setShowMoreCats(s => !s)}>{showMoreCats ? "Hide ▲" : "Show more ▼"}</button>
              {showMoreCats && MORE_CATEGORIES.map(cat => (
                <button key={cat} className="nav-item" onClick={() => getSearchedMedia(cat)}>{cat}</button>
              ))}
            </div>

            <a href="https://pirateruler.com" target="_blank" rel="noreferrer" className="pirateruler-link">PirateRuler.com</a>

            <hr style={{ margin: "10px 0" }} />
            <a href="https://www.pirateruler.com/post/about.html" target="_blank" rel="noreferrer">About</a><br />
            <a href="https://www.pirateruler.com/post/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a><br />
            <a href="https://www.pirateruler.com/post/contact.html" target="_blank" rel="noreferrer">Contact</a><br />
            <a href="https://www.pirateruler.com/post/terms.html" target="_blank" rel="noreferrer">Terms</a>
          </nav>

          <div className="sidebar-controls">
            <button className="theme-btn" onClick={toggleTheme}>{theme === "light" ? <FaMoon /> : <FaSun />} {theme === "light" ? "Dark" : "Light"}</button>
            <button className="fav-btn" onClick={() => { setShowFavorites(true); setSidebarOpen(false); }}><FaHeart /> Favorites <span className="fav-count">{favoriteCount}</span></button>
          </div>
          <small>© {new Date().getFullYear()} PirateRuler</small>
        </div>
      </aside>

      {/* Header */}
      <header className="header">
        <div className="left">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}><FaBars /></button>
          <h1 className="brand">Stocks by <a href="https://pirateruler.com" target="_blank" rel="noreferrer">PirateRuler</a></h1>
        </div>

        <div className="center">
          <form onSubmit={handleSearch} className="search-form">
            <input name="q" placeholder="Search photos or videos..." />
            <button type="submit"><IoSearch /></button>
          </form>

          <div className="filter-row">
            <button className={filterMode === "all" ? "active" : ""} onClick={() => setFilterMode("all")}>All</button>
            <button className={filterMode === "photos" ? "active" : ""} onClick={() => setFilterMode("photos")}>Photos</button>
            <button className={filterMode === "videos" ? "active" : ""} onClick={() => setFilterMode("videos")}>Videos</button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="main-content">
        <div className="container">
          <div className="gallery">
            {noResults ? <div className="no-results">No results found</div> :
              showFavorites ? RenderMedia(favorites) : RenderMedia(media)}
          </div>

          <div ref={loader} style={{ height: 10 }} />
          {loading && <div className="loading"><BsGlobeCentralSouthAsia /> Loading...</div>}
        </div>
      </main>

      {/* Normal footer */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>Powered by <a href="https://pirateruler.com">PirateRuler</a></div>
          <div className="footer-links">
            <a href="https://pirateruler.com">Main</a> •
            <a href="https://www.pirateruler.com/post/about.html">About</a> •
            <a href="https://www.pirateruler.com/post/privacy.html">Privacy</a> •
            <a href="https://www.pirateruler.com/post/contact.html">Contact</a> •
            <a href="https://www.pirateruler.com/post/terms.html">Terms</a>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
