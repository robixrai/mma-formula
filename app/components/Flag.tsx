"use client";

import React from "react";

type Props = {
  code?: string | null;
  size?: number;
  alt?: string;
  className?: string;
};

export default function Flag({ code, size = 18, alt, className }: Props) {
  if (!code) return null;
  const cc = String(code).trim().toLowerCase();
  if (!cc) return null;
  const src = `https://flagcdn.com/${cc}.svg`;
  const h = Math.round(size * 0.66);
  return (
    <img
      src={src}
      alt={alt ?? cc}
      width={size}
      height={h}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", borderRadius: 2 }}
      onError={(e) => {
        const target = e.currentTarget as HTMLImageElement;
        target.onerror = null;
        target.src = "/flags/placeholder.svg";
      }}
    />
  );
}
