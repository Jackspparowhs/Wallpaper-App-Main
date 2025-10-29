import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { IoSearch } from "react-icons/io5";
import { FaMoon, FaSun, FaHeart, FaDownload, FaBars } from "react-icons/fa";
import { BsGlobeCentralSouthAsia } from "react-icons/bs";
import "./App.css";

function App() {
  const API_KEY = "ndFZWMqcwlbe4uaEQAjp48nuA7t17Agu18kaGyieUpXK5UIDUEqsGVvl";
  const CACHE_DURATION = useMemo(() => 1000 * 60 * 60, []); // 1 hour cache

  // expanded categories list
  const CATEGORIES = [
    "Nature",
    "Technology",
    "Cars",
    "People",
    "Space",
    "Food",
    "Architecture",
    "Travel",
    "Animals",
    "Mountains",
    "Forest",
    "Beaches",
    "Cities",
    "Abstract",
    "Business",
    "Fitness",
    "Night",
    "Macro",
  ];

  const [media, setMedia] = useState([]); // photos + videos combined
  const [favorites, setFavorites] = useState(() => {
    const savedFavorites = localStorage.getItem("favorites");
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });
  const [favoriteCount, setFavoriteCount] = useState(favorites.length);
  const [pageIndex, setPageIndex] = useState(1);
  const [searchValueGlobal, setSearchValueGlobal] = useState("");
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showPreloader, setShowPreloader] = useState(true);
  const [showFavorites, setShowFavorites] = useState(false);
  const [suggestions, setSuggestions] = useState(() => {
    const saved = localStorage.getItem("recentSearches");
    return saved
      ? JSON.parse(saved)
      : ["Nature", "Space", "Food", "Travel", "Architecture"];
  });
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return (
      savedTheme ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light")
    );
  });
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const loader = useRef(null);

  // utility: shuffle array (Fisher-Yates)
  const shuffleArray = useCallback((arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, []);

  // --- FETCH HELPERS ---
  const fetchData = useCallback(
    async (url) => {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            Authorization: API_KEY,
          },
        });
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("API fetch error:", error);
        return { photos: [], videos: [] };
      }
    },
    [API_KEY]
  );

  const fetchPhotosAndVideos = useCallback(
    async (query, page = 1) => {
      // per_page tuned to return a decent mixed set
      const photoURL = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        query
      )}&page=${page}&per_page=12`;
      const videoURL = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
        query
      )}&page=${page}&per_page=6`;

      const [photoData, videoData] = await Promise.all([
        fetchData(photoURL),
        fetchData(videoURL),
      ]);

      const photos =
        photoData.photos?.map((p) => ({
          id: `photo-${p.id}`,
          type: "photo",
          photographer: p.photographer,
          src: p.src, // includes large, original etc.
        })) || [];

      const videos =
        videoData.videos?.map((v) => ({
          id: `video-${v.id}`,
          type: "video",
          photographer: v.user?.name || "Unknown",
          src: {
            large: v.video_pictures?.[0]?.picture || "",
            original:
              v.video_files?.find((f) => f.quality === "hd")?.link ||
              v.video_files?.[0]?.link ||
              "",
          },
        })) || [];

      // return combined with photos first then videos
      return [...photos, ...videos];
    },
    [fetchData]
  );

  // --- SEARCH + LOAD with shuffle + random page options ---
  const getSearchedMedia = useCallback(
    async (searchValue, index = 1, isAppending = false) => {
      setLoading(true);
      setNoResults(false);

      const combinedResults = await fetchPhotosAndVideos(searchValue, index);

      // shuffle results to avoid identical ordering
      const shuffled = shuffleArray(combinedResults);

      if (shuffled.length === 0) {
        setNoResults(true);
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setMedia((prev) =>
        isAppending
          ? [
              ...new Map(
                [...prev, ...shuffled].map((m) => [m.id, m])
              ).values(),
            ]
          : shuffled
      );

      setLoading(false);
    },
    [fetchPhotosAndVideos, shuffleArray]
  );

  // pick random integer in [min, max]
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // --- INITIAL LOAD: random category & random page for variety ---
  useEffect(() => {
    const timer = setTimeout(() => setShowPreloader(false), 900);
    // pick random category and random page to vary results
    const initialCategory = CATEGORIES[randInt(0, CATEGORIES.length - 1)];
    const initialPage = randInt(1, 6); // choose page 1..6
    setSearchValueGlobal(initialCategory);
    getSearchedMedia(initialCategory, initialPage);
    setSelectedSuggestion(initialCategory);
    return () => clearTimeout(timer);
  }, [getSearchedMedia]); // only on mount

  // --- INFINITE SCROLL ---
  const handleObserver = useCallback(
    (entries) => {
      const target = entries[0];
      if (target.isIntersecting && !loading && hasMore) {
        const nextPage = pageIndex + 1;
        // use same query or fallback to random category
        const query = searchValueGlobal || CATEGORIES[randInt(0, CATEGORIES.length - 1)];
        getSearchedMedia(query, nextPage, true);
        setPageIndex((p) => p + 1);
      }
    },
    [loading, hasMore, getSearchedMedia, searchValueGlobal, pageIndex, CATEGORIES]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "200px",
      threshold: 0,
    });
    const currentLoader = loader.current;
    if (currentLoader) observer.observe(currentLoader);
    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [handleObserver]);

  // --- THEME ---
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  // --- FAVORITES ---
  const toggleFavorite = useCallback((e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const exists = prev.some((fav) => fav.id === item.id);
      const updated = exists ? prev.filter((fav) => fav.id !== item.id) : [...prev, item];
      localStorage.setItem("favorites", JSON.stringify(updated));
      setFavoriteCount(updated.length);
      return updated;
    });
  }, []);

  const isFavorited = useCallback((id) => favorites.some((fav) => fav.id === id), [favorites]);

  // --- DOWNLOAD (does NOT change global loading) ---
  const handleDownload = useCallback(async (e, url, name) => {
    e.preventDefault();
    e.stopPropagation();
    if (!url) {
      alert("Download URL not available.");
      return;
    }
    try {
      // keep this operation local to the function so it doesn't show page loader
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const ext = url.split(".").pop().split("?")[0].slice(0, 4);
      link.download = `${name || "download"}-${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed. Please try again.");
    }
  }, []);

  // --- RENDER MEDIA ---
  const RenderMedia = useCallback(
    (items) =>
      items.map((item) => (
        <div className="item" key={item.id} onClick={() => { /* future lightbox viewer here */ }}>
          {item.type === "photo" ? (
            <img src={item.src.large} alt={item.photographer} loading="lazy" />
          ) : (
            <div className="video-wrapper">
              <video
                controls
                poster={item.src.large}
                className="video-item"
                preload="metadata"
              >
                <source src={item.src.original} type="video/mp4" />
                Your browser does not support video.
              </video>
            </div>
          )}

          <h3>{item.photographer}</h3>

          <div className="item-actions">
            <button
              className="download-btn"
              onClick={(e) =>
                handleDownload(
                  e,
                  item.type === "photo" ? item.src.original : item.src.original,
                  item.photographer
                )
              }
              title="Download"
            >
              <FaDownload />
            </button>

            <button
              className={`heart-btn ${isFavorited(item.id) ? "favorited" : ""}`}
              onClick={(e) => toggleFavorite(e, item)}
              title={isFavorited(item.id) ? "Remove favorite" : "Add favorite"}
            >
              <FaHeart />
            </button>
          </div>
        </div>
      )),
    [handleDownload, isFavorited, toggleFavorite]
  );

  // --- SEARCH HANDLER ---
  const handleSearch = (e) => {
    e.preventDefault();
    const val = e.target.querySelector("input").value.trim();
    if (!val) return;
    setSearchValueGlobal(val);
    // use random page on new searches to reduce repetition
    const randPage = randInt(1, 6);
    getSearchedMedia(val, randPage);
    // save to recent
    setSuggestions((prev) => {
      const updated = [val, ...prev.filter((s) => s !== val)].slice(0, 8);
      localStorage.setItem("recentSearches", JSON.stringify(updated));
      return updated;
    });
    e.target.querySelector("input").value = "";
    setSidebarOpen(false);
  };

  // simple cache clear (preserve favorites + theme)
  const clearCache = () => {
    Object.keys(localStorage).forEach((k) => {
      if (!k.startsWith("favorites") && !k.startsWith("theme") && !k.startsWith("recentSearches")) {
        localStorage.removeItem(k);
      }
    });
    alert("Cache cleared (favorites & theme preserved).");
  };

  return (
    <>
      {showPreloader && (
        <div className="preloader">
          <h2>Stocks by PirateRuler</h2>
        </div>
      )}

      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-hidden={!sidebarOpen}>
        <div className="sidebar-inner">
          <div className="sidebar-header">
            <h2>PirateRuler</h2>
            <p className="sidebar-tag">Stocks · Photos · Videos</p>
          </div>

          <nav className="sidebar-nav">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className="nav-item"
                onClick={() => { getSearchedMedia(cat, randInt(1, 6)); setSidebarOpen(false); setSearchValueGlobal(cat); setSelectedSuggestion(cat); }}
              >
                {cat}
              </button>
            ))}

            <a className="nav-link" href="https://pirateruler.com" target="_blank" rel="noreferrer">PirateRuler.com</a>
          </nav>

          <div className="sidebar-controls">
            <div className="theme-block">
              <button className="theme-btn" onClick={toggleTheme}>
                {theme === "dark" ? <FaSun /> : <FaMoon />} &nbsp; {theme === "dark" ? "Light" : "Dark"}
              </button>
            </div>

            <div className="fav-block">
              <button className="fav-btn" onClick={() => { setShowFavorites(true); setSidebarOpen(false); }}>
                <FaHeart /> &nbsp; Favorites <span className="fav-count">{favoriteCount}</span>
              </button>
            </div>

            <div className="cache-block">
              <button className="cache-btn" onClick={clearCache}>Clear cache</button>
            </div>
          </div>

          <div className="sidebar-footer">
            <small>© {new Date().getFullYear()} PirateRuler</small>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div className="left-controls">
            <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <FaBars />
            </button>

            <h1 className="brand" onClick={() => getSearchedMedia("nature")}>
              Stocks by <a href="https://pirateruler.com" target="_blank" rel="noreferrer">PirateRuler.com</a>
            </h1>
          </div>

          <div className="right-controls">
            <div className="search-container">
              <form onSubmit={handleSearch}>
                <input type="text" placeholder="Search photos or videos..." aria-label="Search photos or videos" />
                <button type="submit" className="search-btn" aria-label="Search">
                  <IoSearch />
                </button>
              </form>

              <div className="suggestions-pills">
                {suggestions.slice(0, 8).map((s, i) => (
                  <button
                    key={i}
                    className={`pill-item ${selectedSuggestion === s ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedSuggestion(s);
                      setSearchValueGlobal(s);
                      getSearchedMedia(s, randInt(1,6));
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="header-icons">
              <button className="icon-button" title="Favorites" onClick={() => setShowFavorites((p) => !p)}>
                <FaHeart />
                <span className="fav-count header-fav">{favoriteCount}</span>
              </button>
            </div>
          </div>
        </header>

        <section className="hero">
          <div className="hero-inner">
            <h2>Download stock photos & videos</h2>
            <p className="hero-desc">Over 10M+ free stock photos & videos (via Pexels & Pixabay). Search, preview and download — fresh results each visit.</p>
            <div className="hero-cta">
              <button className="cta-btn" onClick={() => getSearchedMedia("popular", randInt(1,6))}>Explore Popular</button>
              <button className="cta-cta" onClick={() => getSearchedMedia("trending", randInt(1,6))}>Trending</button>
            </div>
          </div>
        </section>

        <section className="gallery-section">
          <div className="container">
            <div className="gallery">
              {noResults ? (
                <div className="no-results">No media found for your search.</div>
              ) : showFavorites ? (
                favorites.length > 0 ? (
                  RenderMedia(favorites)
                ) : (
                  <div className="no-results">No favorites yet. Try searching!</div>
                )
              ) : (
                RenderMedia(media)
              )}

              <div ref={loader} style={{ height: "1rem", padding: "1rem" }}></div>

              {loading && (
                <div className="loading">
                  <BsGlobeCentralSouthAsia /> Loading...
                </div>
              )}
            </div>
          </div>
        </section>

        <footer className="site-footer">
          <div className="footer-inner">
            <div>Powered by PirateRuler</div>
            <div className="footer-links">
              <a href="https://pirateruler.com" target="_blank" rel="noreferrer">Main site</a>
              <a href="https://pexels.com" target="_blank" rel="noreferrer">Pexels</a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

export default App;
