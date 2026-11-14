import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { parkPhotos } from "./parkPhotos";

const slides = [
  ["botanic-gardens", "Singapore Botanic Gardens"],
  ["east-coast", "East Coast Park"],
  ["marina-barrage", "Marina Barrage"],
  ["bishan-park", "Bishan–Ang Mo Kio Park"],
  ["macritchie", "MacRitchie Reservoir"],
  ["jurong-lake", "Jurong Lake Gardens"],
  ["pasir-ris", "Pasir Ris Park"],
  ["southern-ridges", "Southern Ridges"],
  ["woodlands-waterfront", "Woodlands Waterfront"],
  ["punggol-waterway", "Punggol Waterway Park"],
] as const;

export function HeroSlideshow() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);

  useEffect(() => {
    const visibilityChanged = () => setHidden(document.hidden);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => { if (preference.matches) setPaused(true); };
    document.addEventListener("visibilitychange", visibilityChanged);
    preference.addEventListener("change", motionChanged);
    return () => {
      document.removeEventListener("visibilitychange", visibilityChanged);
      preference.removeEventListener("change", motionChanged);
    };
  }, []);

  useEffect(() => {
    if (paused || hovered || focused || hidden) return;
    const timer = window.setInterval(() => {
      setCurrent((previous) => (previous + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, hidden]);

  function step(direction: number) {
    setCurrent((previous) => (previous + direction + slides.length) % slides.length);
  }

  return (
    <div
      className="hero-slideshow"
      role="region"
      aria-roledescription="carousel"
      aria-label="Singapore park photographs"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="hero-photo" aria-live={paused ? "polite" : "off"}>
        {slides.map(([id, name], index) => (
          <div
            key={id}
            className={`hero-slide ${index === current ? "active" : ""}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}: ${name}`}
            aria-hidden={index !== current}
          >
            <img
              src={parkPhotos[id].src}
              alt={index === current ? parkPhotos[id].alt : ""}
              fetchPriority={index === 0 ? "high" : "auto"}
              loading={index === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
      <div className="slideshow-controls">
        <button type="button" aria-label="Previous park photo" onClick={() => step(-1)}>
          <ChevronLeft size={17} />
        </button>
        <div className="slideshow-dots" role="group" aria-label="Choose a park photo">
          {slides.map(([id, name], index) => (
            <button
              key={id}
              type="button"
              className={index === current ? "active" : ""}
              aria-label={`Show ${name} photo`}
              aria-pressed={index === current}
              title={name}
              onClick={() => setCurrent(index)}
            />
          ))}
        </div>
        <button type="button" aria-label="Next park photo" onClick={() => step(1)}>
          <ChevronRight size={17} />
        </button>
        <button
          type="button"
          aria-label={paused ? "Play slideshow" : "Pause slideshow"}
          onClick={() => setPaused((previous) => !previous)}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>
    </div>
  );
}
