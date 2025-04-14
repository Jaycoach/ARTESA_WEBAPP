import React from 'react';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const FieldValidation = ({ value, rules }) => {
  return (
    <div className="mt-2 space-y-1 text-xs text-gray-600">
      {rules.map((rule, idx) => {
        const isValid = rule.validate(value);
        return (
          <div key={idx} className="flex items-center space-x-1">
            {isValid ? (
              <FaCheckCircle className="text-green-500" />
            ) : (
              <FaExclamationCircle className="text-red-500" />
            )}
            <span className={isValid ? 'text-green-600' : 'text-red-600'}>
              {rule.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default FieldValidation;