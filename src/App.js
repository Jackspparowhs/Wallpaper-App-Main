import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { IoSearch } from "react-icons/io5";
import { FaMoon, FaSun, FaHeart, FaDownload } from "react-icons/fa";
import { BsGlobeCentralSouthAsia } from "react-icons/bs";
import "./App.css";

function App() {
  const API_KEY = "ndFZWMqcwlbe4uaEQAjp48nuA7t17Agu18kaGyieUpXK5UIDUEqsGVvl";
  const CACHE_DURATION = useMemo(() => 1000 * 60 * 60, []); // 1 hour

  const [media, setMedia] = useState([]);
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("favorites");
    return saved ? JSON.parse(saved) : [];
  });
  const [favoriteCount, setFavoriteCount] = useState(favorites.length);
  const [pageIndex, setPageIndex] = useState(1);
  const [searchValueGlobal, setSearchValueGlobal] = useState("");
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showPreloader, setShowPreloader] = useState(true);
  const [showFavorites, setShowFavorites] = useState(false);
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
  const [selectedCategory, setSelectedCategory] = useState("Nature");

  const loader = useRef(null);

  // ---------------- FETCH ----------------
  const fetchData = useCallback(async (url) => {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: API_KEY,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("API fetch error:", error);
      return { photos: [], videos: [] };
    }
  }, [API_KEY]);

  const fetchPhotosAndVideos = useCallback(async (query, page = 1) => {
    const photoURL = `https://api.pexels.com/v1/search?query=${query}&page=${page}&per_page=10`;
    const videoURL = `https://api.pexels.com/videos/search?query=${query}&page=${page}&per_page=5`;

    const [photoData, videoData] = await Promise.all([
      fetchData(photoURL),
      fetchData(videoURL),
    ]);

    const photos =
      photoData.photos?.map((p) => ({
        id: `photo-${p.id}`,
        type: "photo",
        photographer: p.photographer,
        src: p.src,
      })) || [];

    const videos =
      videoData.videos?.map((v) => ({
        id: `video-${v.id}`,
        type: "video",
        photographer: v.user?.name || "Unknown",
        src: {
          thumbnail: v.video_pictures?.[0]?.picture,
          original: v.video_files?.[0]?.link,
        },
      })) || [];

    return [...photos, ...videos];
  }, [fetchData]);

  // ---------------- LOAD ----------------
  const getMedia = useCallback(
    async (query = "nature", page = 1, append = false) => {
      setLoading(true);
      const newMedia = await fetchPhotosAndVideos(query, page);

      if (newMedia.length === 0) {
        setNoResults(true);
        setHasMore(false);
      } else setHasMore(true);

      setMedia((prev) =>
        append
          ? [...new Map([...prev, ...newMedia].map((m) => [m.id, m])).values()]
          : newMedia
      );
      setLoading(false);
    },
    [fetchPhotosAndVideos]
  );

  useEffect(() => {
    const timer = setTimeout(() => setShowPreloader(false), 1800);
    getMedia(selectedCategory);
    return () => clearTimeout(timer);
  }, [getMedia, selectedCategory]);

  // ---------------- THEME ----------------
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // ---------------- FAVORITES ----------------
  const toggleFavorite = (item) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === item.id);
      const updated = exists
        ? prev.filter((f) => f.id !== item.id)
        : [...prev, item];
      localStorage.setItem("favorites", JSON.stringify(updated));
      setFavoriteCount(updated.length);
      return updated;
    });
  };

  const isFavorited = (id) => favorites.some((f) => f.id === id);

  // ---------------- DOWNLOAD ----------------
  const handleDownload = async (url, name) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${name}-${Date.now()}`;
      link.click();
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  // ---------------- SCROLL ----------------
  const handleObserver = useCallback(
    (entries) => {
      const target = entries[0];
      if (target.isIntersecting && !loading && hasMore) {
        getMedia(searchValueGlobal || selectedCategory, pageIndex + 1, true);
        setPageIndex((p) => p + 1);
      }
    },
    [loading, hasMore, getMedia, searchValueGlobal, pageIndex, selectedCategory]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 0,
    });
    const currentLoader = loader.current;
    if (currentLoader) observer.observe(currentLoader);
    return () => currentLoader && observer.unobserve(currentLoader);
  }, [handleObserver]);

  // ---------------- RENDER ----------------
  const RenderMedia = (items) =>
    items.map((item) => (
      <div className="item" key={item.id}>
        {item.type === "photo" ? (
          <img src={item.src.large} alt={item.photographer} className="media-img" />
        ) : (
          <video controls poster={item.src.thumbnail} className="media-video">
            <source src={item.src.original} type="video/mp4" />
          </video>
        )}
        <h3>{item.photographer}</h3>
        <div className="item-actions">
          <button
            className="download-btn"
            onClick={() => handleDownload(item.src.original, item.photographer)}
          >
            <FaDownload />
          </button>
          <FaHeart
            className={`favorite-btn ${isFavorited(item.id) ? "favorited" : ""}`}
            onClick={() => toggleFavorite(item)}
          />
        </div>
      </div>
    ));

  // ---------------- SEARCH ----------------
  const handleSearch = (e) => {
    e.preventDefault();
    const val = e.target.querySelector("input").value.trim();
    if (!val) return;
    setSearchValueGlobal(val);
    getMedia(val);
  };

  // ---------------- UI ----------------
  return (
    <>
      {showPreloader && (
        <div className="preloader">
          <h2>Loading PirateRuler Stocks...</h2>
        </div>
      )}
      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <h2 className="logo">
            <a href="https://pirateruler.com" target="_blank" rel="noreferrer">
              PirateRuler
            </a>
          </h2>
          <nav>
            {["Nature", "Technology", "Cars", "People", "Space"].map((cat) => (
              <div
                key={cat}
                className={`sidebar-item ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  getMedia(cat);
                }}
              >
                {cat}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button onClick={toggleTheme} className="icon-button">
              {theme === "dark" ? <FaSun /> : <FaMoon />}
            </button>
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className="icon-button"
            >
              {showFavorites ? <BsGlobeCentralSouthAsia /> : <FaHeart />}
              <span className="fav-count">{favoriteCount}</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="content">
          <header className="header">
            <form onSubmit={handleSearch} className="search-bar">
              <input type="text" placeholder="Search photos or videos..." />
              <button type="submit" className="icon-button">
                <IoSearch />
              </button>
            </form>
          </header>

          <div className="gallery">
            {noResults ? (
              <div className="no-results">No media found.</div>
            ) : showFavorites ? (
              favorites.length > 0 ? (
                RenderMedia(favorites)
              ) : (
                <div className="no-results">No favorites yet.</div>
              )
            ) : (
              RenderMedia(media)
            )}

            <div ref={loader} style={{ height: "1rem" }}></div>
            {loading && (
              <div className="loading">
                <BsGlobeCentralSouthAsia /> Loading...
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
