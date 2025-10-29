import React from "react";
import { Link } from "react-router-dom";

function DevPage() {
  return (
    <div className="dev-page">
      <h1>About the Developer</h1>
      <p>
        This application was built by Ragnar. It showcases a gallery of
        curated images fetched from the Pexels API. You can search, favorite,
        and download images.
      </p>
      <p>
        Feel free to explore the source code or contact me for more
        information.
      </p>
      <Link to="/" className="back-button">
        Back to Gallery
      </Link>
    </div>
  );
}

export default DevPage;
