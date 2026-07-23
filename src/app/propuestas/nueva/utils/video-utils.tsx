"use client";
import React, { useEffect, useRef } from "react";
import type { Seccion } from "../types";

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function youtubeEmbed(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1` : null;
}

let youtubeApiPromise: Promise<any> | null = null;
function loadYoutubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if ((window as any).YT?.Player) return Promise.resolve((window as any).YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise(resolve => {
    const previous = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve((window as any).YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

export function VideoBg({ url, className, style, onEnded }: { url: string; className?: string; style?: React.CSSProperties; onEnded?: () => void }) {
  const embed = youtubeEmbed(url);
  const id = youtubeId(url);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    if (!onEnded || !id || !containerRef.current) return;
    let disposed = false;
    // Nodo interno creado fuera del árbol de React: YT.Player lo reemplaza por su propio
    // iframe, y React nunca vuelve a tocarlo (evita el "removeChild" al desmontar/re-render).
    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    containerRef.current.appendChild(mount);

    loadYoutubeApi().then(YT => {
      if (disposed) return;
      playerRef.current = new YT.Player(mount, {
        videoId: id,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: 1, mute: 1, controls: 0, playsinline: 1, rel: 0,
          modestbranding: 1, iv_load_policy: 3, disablekb: 1,
        },
        events: {
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.ENDED) onEndedRef.current?.();
          },
        },
      });
    });
    return () => {
      disposed = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
      mount.remove();
    };
  }, [id, onEnded]);

  if (onEnded && id) {
    return (
      <div className={className} style={{ ...style, overflow: "hidden", position: "relative", containerType: "size" }}>
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "max(100cqw, 177.78cqh)",
            height: "max(100cqh, 56.25cqw)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  if (embed) {
    return (
      <div className={className} style={{ ...style, overflow: "hidden", position: "relative", containerType: "size" }}>
        <iframe
          src={embed}
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
