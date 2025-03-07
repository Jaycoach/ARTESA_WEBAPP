import React from "react";
import "./Banner.scss";

const Banner = ({ imageUrl, altText }) => {
  return (
    <div className="banner">
      <img src={imageUrl} alt={altText || "Banner"} />
    </div>
  );
};

export default Banner;