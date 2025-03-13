import React from 'react';
import PropTypes from 'prop-types';

const Button = ({ children, variant, className, disabled, onClick, type }) => {
  const baseStyles = 'rounded-lg px-4 py-2 font-semibold transition duration-200 ease-in-out';
  const variants = {
    primary: 'bg-yellow-500 text-white hover:bg-yellow-600',
    secondary: 'bg-gray-200 text-gray-800',
    outline: 'border border-gray-300 bg-transparent',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline']),
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