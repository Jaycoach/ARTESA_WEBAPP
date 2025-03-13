import React from 'react';
import PropTypes from 'prop-types';

const Input = ({ type, placeholder, value, onChange, className, name, required, disabled }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    className={className}
    name={name}
    required={required}
    disabled={disabled}
  />
);

Input.propTypes = {
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool
};

Input.defaultProps = {
  type: 'text',
  placeholder: '',
  className: '',
  disabled: false
};

export default Input;