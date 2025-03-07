import React from "react";
import "../../../../App.scss";

const Banner = ({ imageUrl, altText }) => {
  return (
    <div className="banner">
      <img src={imageUrl} alt={altText} />
    </div>
  );
};

export default Banner;