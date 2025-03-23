import React from 'react';
import PropTypes from 'prop-types';

const Button = ({ children, variant, className, disabled, onClick, type }) => {
  const baseStyles = 'rounded-lg px-4 py-2 font-semibold transition duration-200 ease-in-out';

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary/90',
    secondary: 'bg-secondary text-black hover:bg-secondary/80',
    accent: 'bg-accent text-white hover:bg-accent/90',
    outline: 'border border-gray-300 bg-transparent text-gray-800 hover:bg-gray-100',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'accent', 'outline']),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

Button.defaultProps = {
  variant: 'primary',
  type: 'button',
  className: '',
  disabled: false,
};

export default Button;