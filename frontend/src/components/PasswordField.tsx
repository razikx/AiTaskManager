import React, { useState } from 'react';
import { Key, Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  name: string;
}

export function PasswordField({
  id,
  name,
  placeholder = '••••••••',
  required = true,
  disabled = false,
  className = '',
  ...props
}: PasswordFieldProps): React.JSX.Element {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
        <Key className="w-5 h-5" />
      </span>
      <input
        {...props}
        id={id}
        name={name}
        type={showPassword ? 'text' : 'password'}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full bg-slate-950/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all duration-200 ${className}`}
      />
      <button
        type="button"
        tabIndex={-1} // Prevent keyboard tab focus from trapping on hover icon, keeping standard accessibility flows
        onMouseEnter={() => !disabled && setShowPassword(true)}
        onMouseLeave={() => setShowPassword(false)}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none disabled:opacity-50"
        disabled={disabled}
      >
        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}
