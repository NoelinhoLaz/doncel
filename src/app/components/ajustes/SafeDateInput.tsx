"use client";

import { useState, useEffect } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
  className?: string;
}

export default function SafeDateInput({ value, onChange, style, className }: Props) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => { setLocalVal(value); }, [value]);

  return (
    <input
      type="date"
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => onChange(localVal)}
      style={style}
      className={className}
    />
  );
}
