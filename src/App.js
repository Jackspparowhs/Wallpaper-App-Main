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

  const [images, setImages] = useState([]);
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
      : ["Portrait", "Illustration", "Abstract", "Space"];
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

  const fetchImages = useCallback(
    async (url) => {
      const cacheKey = `image_cache_${url}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      }

      try {
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            Authorization: API_KEY,
          },
        });
        const data = await response.json();

        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          })
        );

        return data;
      } catch (error) {
        console.error("API fetch error:", error);
        return { photos: [] };
      }
    },
    [API_KEY, CACHE_DURATION]
  );

  const getImages = useCallback(
    async (index, isAppending = false) => {
      setLoading(true);
      setNoResults(false);
      const baseURL = `https://api.pexels.com/v1/curated?page=${index}&per_page=12`;
      const data = await fetchImages(baseURL);

      if (data.photos.length === 0) {
        setNoResults(!isAppending);
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setImages((prevImages) =>
        isAppending
          ? [
              ...new Map(
                [...prevImages, ...data.photos].map((img) => [img.id, img])
              ).values(),
            ]
          : data.photos
      );

      setPageIndex(index);
      setLoading(false);
    },
    [fetchImages]
  );

  const getSearchedImages = useCallback(
    async (searchValue, index = 1, isAppending = false) => {
      setLoading(true);
      setNoResults(false);
      const baseURL = `https://api.pexels.com/v1/search?query=${searchValue}&page=${index}&per_page=12`;
      const data = await fetchImages(baseURL);

      if (data.photos.length === 0) {
        setNoResults(!isAppending);
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setImages((prevImages) =>
        isAppending
          ? [
              ...new Map(
                [...prevImages, ...data.photos].map((img) => [img.id, img])
              ).values(),
            ]
          : data.photos
      );

      setLoading(false);
    },
    [fetchImages]
  );

  const handleSuggestionClick = (suggestion) => {
    setSearchValueGlobal(suggestion);
    getSearchedImages(suggestion);
    setSelectedSuggestion(suggestion);

    setSuggestions((prev) => {
      const updated = [...prev];
      localStorage.setItem("recentSearches", JSON.stringify(updated));
      return updated;
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const searchValue = e.target.querySelector("input").value;
    if (!searchValue.trim()) return;

    setSearchValueGlobal(searchValue);
    getSearchedImages(searchValue);
    setSuggestions((prev) => {
      const updated = [
        searchValue,
        ...prev.filter((s) => s !== searchValue),
      ].slice(0, 5);
      localStorage.setItem("recentSearches", JSON.stringify(updated));
      return updated;
    });

    e.target.querySelector("input").value = "";
  };

  const handleObserver = useCallback(
    (entries) => {
      const target = entries[0];
      if (target.isIntersecting && !loading && hasMore) {
        if (searchValueGlobal) {
          getSearchedImages(searchValueGlobal, pageIndex + 1, true);
        } else {
          getImages(pageIndex + 1, true);
        }
      }
    },
    [
      loading,
      hasMore,
      searchValueGlobal,
      pageIndex,
      getSearchedImages,
      getImages,
    ]
  );

  useEffect(() => {
    const currentLoader = loader.current;
    const option = {
      root: null,
      rootMargin: "20px",
      threshold: 0,
    };
    const observer = new IntersectionObserver(handleObserver, option);
    if (currentLoader) observer.observe(currentLoader);

    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [handleObserver]);

  const handleHeaderClick = () => {
    setImages([]);
    setPageIndex(1);
    setSearchValueGlobal("");
    setNoResults(false);
    setHasMore(true);
    setShowFavorites(false);
    setSelectedSuggestion(null);
    getImages(1);
  };

  useEffect(() => {
    const clearOldCache = () => {
      const now = Date.now();
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("image_cache_") || key.startsWith("search_")) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (now - item.timestamp > CACHE_DURATION) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            localStorage.removeItem(key);
          }
        }
      });
    };

    clearOldCache();
    const timer = setTimeout(() => setShowPreloader(false), 2500);
    getImages(1);

    return () => clearTimeout(timer);
  }, [getImages, CACHE_DURATION]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const toggleFavorite = useCallback((e, photo) => {
    e.preventDefault();
    e.stopPropagation();

    setFavorites((prevFavorites) => {
      const isFavorite = prevFavorites.some((fav) => fav.id === photo.id);
      const updatedFavorites = isFavorite
        ? prevFavorites.filter((fav) => fav.id !== photo.id)
        : [...prevFavorites, photo];

      // Update favorite count
      setFavoriteCount(updatedFavorites.length);

      localStorage.setItem("favorites", JSON.stringify(updatedFavorites));
      return updatedFavorites;
    });
  }, []);

  const clearCache = () => {
    Object.keys(localStorage).forEach((key) => {
      if (
        !key.startsWith("favorites") &&
        !key.startsWith("theme") &&
        !key.startsWith("recentSearches")
      ) {
        localStorage.removeItem(key);
      }
    });
    alert("Cache cleared successfully!, but favorites and theme are safe.");
  };

  const handleDownload = useCallback(async (e, url, photographerName) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${photographerName}-${Date.now()}-Art-Gallery.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Download failed. Please try again.");
    }
  }, []);

  // Move this outside of GenerateHTML to avoid the unnecessary dependency
  const isPhotoFavorited = useCallback(
    (photoId) => favorites.some((fav) => fav.id === photoId),
    [favorites]
  );

  const GenerateHTML = useCallback(
    (photos) =>
      photos.map((photo) => (
        <div className="item" key={photo.id}>
          <a
            href={photo.src.original}
            data-lightbox="Art-Gallery"
            data-title={`${photo.photographer} - ${photo.alt}`}
          >
            <img src={photo.src.large} alt={photo.photographer} />
            <h3>{photo.photographer}</h3>
          </a>
          <a
            href="/"
            className="download-btn"
            onClick={(e) =>
              handleDownload(e, photo.src.original, photo.photographer)
            }
          >
            <FaDownload className="photo-download_info" alt="Download" />
          </a>
          <a href="/">
            <FaHeart
              className={`favorite-btn ${
                isPhotoFavorited(photo.id) ? "favorited" : ""
              }`}
              onClick={(e) => toggleFavorite(e, photo)}
              alt="Like"
            />
          </a>
        </div>
      )),
    [handleDownload, isPhotoFavorited, toggleFavorite]
  );

  return (
    <>
      {showPreloader && (
        <div className="preloader">
          <h2>Art Gallery</h2>
        </div>
      )}
      <section>
        <div className="container">
          <header className="header">
            <h1 onClick={handleHeaderClick} style={{ cursor: "pointer" }}>
              Art Gallery
            </h1>
            <div className="header-icons">
              <button
                onClick={toggleTheme}
                className="icon-button"
                title={
                  theme === "dark"
                    ? "Switch to Light Mode"
                    : "Switch to Dark Mode"
                }
              >
                {theme === "dark" ? <FaSun /> : <FaMoon />}
              </button>
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                className="icon-button"
                title={showFavorites ? "Show All Images" : "Show Favorites"}
                style={{ position: "relative" }}
              >
                {showFavorites ? <BsGlobeCentralSouthAsia  /> : <FaHeart />}
                <span
                  style={{
                    position: "absolute",
                    top: "-10px",
                    right: "-10px",
                    background: "#F16767",
                    color: "white",
                    borderRadius: "50%",
                    padding: "2px 6px",
                    fontSize: "12px",
                  }}
                >
                  {favoriteCount}
                </span>
              </button>
              <button
                onClick={clearCache}
                className="icon-button"
                title="Clear Cache"
              >
                <FaTrash />
              </button>
            </div>
            <div className="search-container">
              <form onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="Search"
                  id="search-input"
                  name="search"
                />
                <button type="submit" className="icon-button">
                  <IoSearch />
                </button>
              </form>
              <div className="suggestions-pills">
                {suggestions.map((suggestion, index) => (
                  <span
                    key={index}
                    className={`pill-item ${
                      selectedSuggestion === suggestion ? "selected" : ""
                    }`}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </span>
                ))}
              </div>
            </div>
          </header>
          <div className="gallery">
            {noResults ? (
              <div className="no-results">No images found for your search.</div>
            ) : showFavorites ? (
              favorites.length > 0 ? (
                GenerateHTML(favorites)
              ) : (
                <div className="no-results">
                  No favorites yet. Go to
                  <h1 className="explore" onClick={handleHeaderClick}>
                    explore!
                  </h1>
                </div>
              )
            ) : (
              GenerateHTML(images)
            )}
            <div ref={loader} style={{ height: "1rem", padding: "1rem" }}></div>
            {loading && (
              <div className="loading">
                <BsGlobeCentralSouthAsia  /> Loading...
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export default App;
