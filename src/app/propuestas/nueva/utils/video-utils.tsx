"use client";
import React from "react";
import type { Seccion } from "../types";

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function youtubeEmbed(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0&enablejsapi=1` : null;
}

export function VideoBg({ url, className, style, onEnded }: { url: string; className?: string; style?: React.CSSProperties; onEnded?: () => void }) {
  const embed = youtubeEmbed(url);
  const embedUrl = onEnded && embed
    ? embed.replace("&loop=1", "").replace(`&playlist=${youtubeId(url)}`, "")
    : embed;
  if (embedUrl) {
    return (
      <div className={className} style={{ ...style, overflow: "hidden", position: "relative", containerType: "size" }}>
        <iframe
          src={embedUrl}
          allow="autoplay; encrypted-media"
          allowFullScreen
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "max(100cqw, 177.78cqh)",
            height: "max(100cqh, 56.25cqw)",
            transform: "translate(-50%, -50%)",
            border: "none",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }
  return (
    <video
      src={url}
      className={className}
      style={{ ...style, objectFit: "cover" }}
      autoPlay
      muted
      loop={!onEnded}
      playsInline
      onEnded={onEnded}
    />
  );
}

export function PortadaBg({ media, className, style }: { media?: Seccion["media"]; className?: string; style?: React.CSSProperties }) {
  if (media?.url) {
    const isVideo = media.tipo === "video";
    return isVideo
      ? <VideoBg url={media.url} className={className} style={style} />
      : <div className={className} style={{ ...style, backgroundImage: `url(${media.url})`, backgroundSize: "cover", backgroundPosition: "center" }} />;
  }
  return <div className={className} style={style} />;
}
