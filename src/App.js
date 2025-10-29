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
  // keep your API key
  const API_KEY = "ndFZWMqcwlbe4uaEQAjp48nuA7t17Agu18kaGyieUpXK5UIDUEqsGVvl";
  const CACHE_DURATION = useMemo(() => 1000 * 60 * 60, []); // 1 hour cache

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
      : ["Nature", "Technology", "Cars", "People", "Space"];
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

  // --- FETCH FUNCTIONS ---
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
          src: p.src, // contains original, large, etc.
        })) || [];

      const videos =
        videoData.videos?.map((v) => ({
          id: `video-${v.id}`,
          type: "video",
          photographer: v.user?.name || "Unknown",
          src: {
            // poster thumbnail (video_pictures) and original video link (video_files)
            large: v.video_pictures?.[0]?.picture || "",
            original:
              v.video_files?.find((f) => f.quality === "hd")?.link ||
              v.video_files?.[0]?.link ||
              "",
          },
        })) || [];

      // Mix photos & videos so they show together (videos after photos)
      return [...photos, ...videos];
    },
    [fetchData]
  );

  // --- SEARCH + LOAD ---
  const getSearchedMedia = useCallback(
    async (searchValue, index = 1, isAppending = false) => {
      setLoading(true);
      setNoResults(false);

      const combinedResults = await fetchPhotosAndVideos(searchValue, index);

      if (combinedResults.length === 0) {
        setNoResults(true);
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setMedia((prev) =>
        isAppending
          ? [
              ...new Map(
                [...prev, ...combinedResults].map((m) => [m.id, m])
              ).values(),
            ]
          : combinedResults
      );

      setLoading(false);
    },
    [fetchPhotosAndVideos]
  );

  // --- INITIAL LOAD ---
  useEffect(() => {
    const timer = setTimeout(() => setShowPreloader(false), 1000);
    getSearchedMedia("nature");
    return () => clearTimeout(timer);
  }, [getSearchedMedia]);

  // --- INFINITE SCROLL ---
  const handleObserver = useCallback(
    (entries) => {
      const target = entries[0];
      if (target.isIntersecting && !loading && hasMore) {
        getSearchedMedia(searchValueGlobal || "nature", pageIndex + 1, true);
        setPageIndex((prev) => prev + 1);
      }
    },
    [loading, hasMore, getSearchedMedia, searchValueGlobal, pageIndex]
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

  // --- DOWNLOAD ---
  const handleDownload = useCallback(async (e, url, name) => {
    e.preventDefault();
    e.stopPropagation();
    if (!url) {
      alert("Download URL not available.");
      return;
    }
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      // determine extension
      const ext = url.split(".").pop().split("?")[0].slice(0, 4);
      link.download = `${name || "download"}-${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed. Try opening video/photo then download.");
    }
  }, []);

  // --- RENDER MEDIA ---
  const RenderMedia = useCallback(
    (items) =>
      items.map((item) => (
        <div className="item" key={item.id} onClick={() => { /* optional: open viewer later */ }}>
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
                Your browser does not support the video tag.
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
    getSearchedMedia(val);
    // save to recent
    setSuggestions((prev) => {
      const updated = [val, ...prev.filter((s) => s !== val)].slice(0, 6);
      localStorage.setItem("recentSearches", JSON.stringify(updated));
      return updated;
    });
    e.target.querySelector("input").value = "";
    setSidebarOpen(false); // close sidebar on mobile after searching
  };

  // small utility: clear caches (not favorites/themes)
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
            <button className="nav-item" onClick={() => { getSearchedMedia("Nature"); setSidebarOpen(false); }}>Nature</button>
            <button className="nav-item" onClick={() => { getSearchedMedia("Technology"); setSidebarOpen(false); }}>Technology</button>
            <button className="nav-item" onClick={() => { getSearchedMedia("Cars"); setSidebarOpen(false); }}>Cars</button>
            <button className="nav-item" onClick={() => { getSearchedMedia("People"); setSidebarOpen(false); }}>People</button>
            <button className="nav-item" onClick={() => { getSearchedMedia("Space"); setSidebarOpen(false); }}>Space</button>

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
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className={`pill-item ${selectedSuggestion === s ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedSuggestion(s);
                      setSearchValueGlobal(s);
                      getSearchedMedia(s);
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
            <p>Over 10M+ free stock photos & videos (via Pexels & Pixabay). Search, preview and download.</p>
            <div className="hero-cta">
              <button className="cta-btn" onClick={() => getSearchedMedia("popular")}>Explore Popular</button>
              <button className="cta-cta" onClick={() => getSearchedMedia("trending")}>Trending</button>
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
