import React, { forwardRef } from 'react';

// Shared control keeps the imported application's class-based variants intact.
const Button = forwardRef(function Button({ type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} {...props} />;
});

export default Button;
