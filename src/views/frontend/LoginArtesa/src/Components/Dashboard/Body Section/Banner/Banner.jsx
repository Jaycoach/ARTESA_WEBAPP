import React from "react";
import "./Banner.css";

const Banner = ({ imageUrl, altText }) => {
  return (
    <div className="banner">
      <img src={imageUrl} alt={altText} />
    </div>
  );
};

export default Banner;