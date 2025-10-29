import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { IoSearch } from "react-icons/io5";
import { FaMoon, FaSun, FaHeart, FaDownload, FaTrash } from "react-icons/fa";
import { BsGlobeCentralSouthAsia } from "react-icons/bs";
import "./App.css";

function App() {
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
      : ["Nature", "Technology", "Cars", "People"];
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
            large: v.video_pictures[0]?.picture,
            original: v.video_files[0]?.link,
          },
        })) || [];

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
    const timer = setTimeout(() => setShowPreloader(false), 2500);
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
      rootMargin: "20px",
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
    setFavorites((prev) => {
      const exists = prev.some((fav) => fav.id === item.id);
      const updated = exists
        ? prev.filter((fav) => fav.id !== item.id)
        : [...prev, item];
      localStorage.setItem("favorites", JSON.stringify(updated));
      setFavoriteCount(updated.length);
      return updated;
    });
  }, []);

  const isFavorited = useCallback(
    (id) => favorites.some((fav) => fav.id === id),
    [favorites]
  );

  // --- DOWNLOAD ---
  const handleDownload = useCallback(async (e, url, name) => {
    e.preventDefault();
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${name}-${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, []);

  // --- RENDER MEDIA ---
  const RenderMedia = useCallback(
    (items) =>
      items.map((item) => (
        <div className="item" key={item.id}>
          {item.type === "photo" ? (
            <img src={item.src.large} alt={item.photographer} />
          ) : (
            <video
              controls
              poster={item.src.large}
              className="video-item"
            >
              <source src={item.src.original} type="video/mp4" />
            </video>
          )}
          <h3>{item.photographer}</h3>
          <div className="item-actions">
            <a
              href="/"
              className="download-btn"
              onClick={(e) => handleDownload(e, item.src.original, item.photographer)}
            >
              <FaDownload />
            </a>
            <FaHeart
              className={`favorite-btn ${isFavorited(item.id) ? "favorited" : ""}`}
              onClick={(e) => toggleFavorite(e, item)}
            />
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
  };

  return (
    <>
      {showPreloader && (
        <div className="preloader">
          <h2>Stocks by PirateRuler</h2>
        </div>
      )}
      <section>
        <div className="container">
          <header className="header">
            <h1 onClick={() => getSearchedMedia("nature")} style={{ cursor: "pointer" }}>
              Stocks by <a href="https://pirateruler.com">PirateRuler.com</a>
            </h1>
            <div className="header-icons">
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
              <button
                onClick={() => {
                  localStorage.clear();
                  alert("Cache cleared!");
                }}
                className="icon-button"
              >
                <FaTrash />
              </button>
            </div>
            <div className="search-container">
              <form onSubmit={handleSearch}>
                <input type="text" placeholder="Search photos or videos..." />
                <button type="submit" className="icon-button">
                  <IoSearch />
                </button>
              </form>
              <div className="suggestions-pills">
                {suggestions.map((s, i) => (
                  <span
                    key={i}
                    className={`pill-item ${selectedSuggestion === s ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedSuggestion(s);
                      setSearchValueGlobal(s);
                      getSearchedMedia(s);
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <div className="gallery">
            {noResults ? (
              <div className="no-results">No media found for your search.</div>
            ) : showFavorites ? (
              favorites.length > 0 ? (
                RenderMedia(favorites)
              ) : (
                <div className="no-results">No favorites yet.</div>
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
    </>
  );
}

export default App;
