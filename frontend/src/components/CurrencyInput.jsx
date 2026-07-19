import { forwardRef } from 'react';

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

export function formatCurrencyInput(value) {
  const digits = digitsOnly(value).replace(/^0+(?=\d)/, '');
  return digits ? Number(digits).toLocaleString('vi-VN') : '';
}

const CurrencyInput = forwardRef(function CurrencyInput({
  value,
  onValueChange,
  onChange,
  min = 0,
  max,
  className = '',
  placeholder = '0 đ',
  ...props
}, ref) {
  const handleChange = (event) => {
    const digits = digitsOnly(event.target.value);
    const nextValue = digits === '' ? '' : String(Number(digits));
    onValueChange?.(nextValue);
    onChange?.({ ...event, target: { ...event.target, value: nextValue } });
  };

  const handleBlur = () => {
    if (value === '' || value === null || value === undefined) return;
    let normalized = Number(value);
    if (Number.isFinite(Number(min))) normalized = Math.max(Number(min), normalized);
    if (max !== undefined && Number.isFinite(Number(max))) normalized = Math.min(Number(max), normalized);
    onValueChange?.(String(Math.round(normalized)));
  };

  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={formatCurrencyInput(value)}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
});

export default CurrencyInput;
