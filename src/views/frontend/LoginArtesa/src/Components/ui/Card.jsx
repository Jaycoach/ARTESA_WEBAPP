import React from 'react';
import PropTypes from 'prop-types';

const Card = ({ children, className }) => {
  return (
    <div className={`bg-white shadow-sm rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
};

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

Card.defaultProps = {
  className: '',
};

export default Card;
