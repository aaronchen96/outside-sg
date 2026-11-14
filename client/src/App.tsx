import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  Bike,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Cloud,
  CloudRain,
  Droplets,
  Footprints,
  Heart,
  Info,
  LayoutGrid,
  Leaf,
  LoaderCircle,
  Map,
  MapPin,
  RefreshCw,
  Search,
  Sprout,
  Sun,
  Thermometer,
  TreePine,
  X,
} from "lucide-react";
import { api } from "./api";
import {
  addLocalPlan,
  readLocalPlans,
  removeLocalPlan,
  resetLocalPlans,
  singaporeDate,
} from "./localPlans";
import { parkPhotos } from "./parkPhotos";
import { HeroSlideshow } from "./HeroSlideshow";
import type { Activity, Dashboard, Destination, Plan, Reading } from "./types";

const activities: { id: Activity; label: string; icon: typeof Footprints }[] = [
  { id: "walk", label: "A slow stroll", icon: Footprints },
  { id: "run", label: "A good run", icon: Heart },
  { id: "cycle", label: "A bike ride", icon: Bike },
  { id: "picnic", label: "A picnic", icon: Sprout },
];
const activityName = (activity: string) =>
  activities.find((a) => a.id === activity)?.label || activity;
const time = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleTimeString("en-SG", {
        timeZone: "Asia/Singapore",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Unavailable";
const dateLabel = (value: string) =>
  new Date(value + "T12:00:00+08:00").toLocaleDateString("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const maxPlanDate = () => singaporeDate(365);
const today = () => singaporeDate();
function WeatherIcon({
  forecast,
  size = 22,
}: {
  forecast: string | null;
  size?: number;
}) {
  return forecast && /rain|showers|thunder/i.test(forecast) ? (
    <CloudRain size={size} />
  ) : forecast && /fair|sunny/i.test(forecast) ? (
    <Sun size={size} />
  ) : (
    <Cloud size={size} />
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function StationReading({
  label,
  reading,
  unit,
}: {
  label: string;
  reading: Reading | null;
  unit: string;
}) {
  return (
    <div className="station-reading">
      <span>{label}</span>
      <strong>{reading ? `${reading.value} ${unit}` : "Unavailable"}</strong>
      <small>
        {reading
          ? `${reading.station} · ${reading.distanceKm.toFixed(1)} km away · ${time(reading.timestamp)}`
          : "No recent nearby station reading"}
      </small>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<Dashboard | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [activity, setActivity] = useState<Activity>("walk"),
    [region, setRegion] = useState("all"),
    [search, setSearch] = useState(""),
    [view, setView] = useState<"grid" | "map">("grid");
  const [page, setPage] = useState<"explore" | "plans">("explore");
  const [plans, setPlans] = useState<Plan[]>([]),
    [plansError, setPlansError] = useState("");
  const [detail, setDetail] = useState<Destination | null>(null),
    [saving, setSaving] = useState<Destination | null>(null);
  const [notice, setNotice] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<Dashboard>(`/dashboard?activity=${activity}&region=${region}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setData(result);
        setDetail((current) =>
          current
            ? result.destinations.find((d) => d.id === current.id) || null
            : null,
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setData(null);
          setDetail(null);
          setError(e.message || "Unable to load destinations.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activity, region, refresh]);
  useEffect(() => {
    const id = setInterval(() => setRefresh((x) => x + 1), 300000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    loadPlans();
    const sync = () => loadPlans();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [page]);
  function loadPlans() {
    try {
      setPlans(readLocalPlans());
      setPlansError("");
    } catch (e) {
      setPlansError((e as Error).message);
    }
  }
  function removePlan(id: string) {
    try {
      setPlans(removeLocalPlan(id));
      setPlansError("");
      setNotice("Plan removed from this browser.");
    } catch (e) {
      setPlansError((e as Error).message);
    }
  }
  function resetPlans() {
    try {
      setPlans(resetLocalPlans());
      setPlansError("");
      setNotice("Saved plans in this browser have been reset.");
    } catch (e) {
      setPlansError((e as Error).message);
    }
  }
  const visible = (data?.destinations || [])
    .filter((d) =>
      (d.name + " " + d.description + " " + d.region)
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const sgDate = new Date().toLocaleDateString("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  function beginSave(d: Destination) {
    setDetail(null);
    setSaving(d);
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("explore");
          }}
          aria-label="Outside Singapore home"
        >
          <span className="brand-mark">
            <TreePine size={24} />
          </span>
          outside<span className="brand-country">SINGAPORE</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={page === "explore" ? "nav-active" : ""}
            onClick={() => setPage("explore")}
          >
            Explore
          </button>
          <button
            className={page === "plans" ? "nav-active" : ""}
            onClick={() => setPage("plans")}
          >
            My plans
          </button>
        </nav>
        <span className="header-note">
          <Leaf size={15} /> A little more outdoors.
        </span>
      </header>
      <main id="main">
        {page === "explore" ? (
          <>
            <section className="hero container">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="tiny-sun">✳</span> LESS SCROLLING. MORE
                  OUTSIDE.
                </div>
                <h1>
                  A little fresh air.
                  <br />
                  <em>A better plan.</em>
                </h1>
                <p>
                  Find your kind of outdoors in Singapore.
                  <br />A little weather wisdom, a place to go, and you’re off.
                </p>
                <a href="#explore" className="text-link">
                  Find your next escape <ArrowDown size={18} />
                </a>
              </div>
              <div className="hero-art">
                <HeroSlideshow />
                <div className="round-stamp">
                  TAKE THE
                  <br />
                  <strong>scenic</strong>
                  <br />
                  ROUTE <ArrowUpRight />
                </div>
              </div>
            </section>
            <section
              className="weather-strip container"
              aria-label="Weather overview"
            >
              <div className="weather-intro">
                <div className="eyebrow">SINGAPORE, TODAY</div>
                <strong>{sgDate}</strong>
                <span className={`status ${data?.status || "unavailable"}`}>
                  <i />
                  {loading
                    ? "Checking weather"
                    : data?.status === "live"
                      ? "Live public weather"
                      : data?.status === "stale"
                        ? "Last available weather"
                        : "Weather unavailable"}
                </span>
              </div>
              <div className="weather-metric">
                <Thermometer />
                <div>
                  <small>24-hour temperature</small>
                  <strong>
                    {data?.summary.temperatureLow != null &&
                    data.summary.temperatureHigh != null
                      ? `${data.summary.temperatureLow}–${data.summary.temperatureHigh}°C`
                      : "—"}
                  </strong>
                </div>
              </div>
              <div className="weather-metric">
                <Droplets />
                <div>
                  <small>24-hour humidity</small>
                  <strong>
                    {data?.summary.humidityLow != null &&
                    data.summary.humidityHigh != null
                      ? `${data.summary.humidityLow}–${data.summary.humidityHigh}%`
                      : "—"}
                  </strong>
                </div>
              </div>
              <div className="weather-metric weather-outlook">
                <WeatherIcon forecast={data?.summary.forecast || null} />
                <div>
                  <small>24-hour outlook</small>
                  <strong>{data?.summary.forecast || "Unavailable"}</strong>
                </div>
              </div>
              <button
                className="icon-button refresh"
                aria-label="Refresh weather"
                title="Refresh weather (server caches for five minutes)"
                onClick={() => setRefresh((x) => x + 1)}
                disabled={loading}
              >
                <RefreshCw size={18} className={loading ? "spin" : ""} />
              </button>
            </section>
            <section className="explore-section container" id="explore">
              <div className="section-header">
                <div>
                  <div className="eyebrow">
                    MAKE ROOM FOR A LITTLE ADVENTURE
                  </div>
                  <h2>What feels like you today?</h2>
                </div>
              </div>
              <div
                className="activity-tabs"
                role="group"
                aria-label="Choose an activity"
              >
                {activities.map((a) => (
                  <button
                    key={a.id}
                    className={activity === a.id ? "selected" : ""}
                    aria-pressed={activity === a.id}
                    onClick={() => setActivity(a.id)}
                  >
                    <a.icon size={20} />
                    {a.label}
                    {activity === a.id && <Check size={16} />}
                  </button>
                ))}
              </div>
              <div className="toolbar">
                <label className="search">
                  <Search size={19} />
                  <input
                    aria-label="Search destinations"
                    placeholder="A park, a place, a little escape…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      className="icon-button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                <label className="region-filter">
                  <MapPin size={17} />
                  <select
                    aria-label="Filter by region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="all">All Singapore</option>
                    {["central", "east", "west", "north", "south"].map((r) => (
                      <option key={r} value={r}>
                        {r[0].toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <div
                  className="view-toggle"
                  role="group"
                  aria-label="Results view"
                >
                  <button
                    aria-label="Grid view"
                    aria-pressed={view === "grid"}
                    className={view === "grid" ? "selected" : ""}
                    onClick={() => setView("grid")}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    aria-label="Map view"
                    aria-pressed={view === "map"}
                    className={view === "map" ? "selected" : ""}
                    onClick={() => setView("map")}
                  >
                    <Map size={18} />
                  </button>
                </div>
              </div>
              {(error || data?.message) && (
                <div className="alert" role={error ? "alert" : "status"}>
                  <Info size={19} />
                  <span>{error || data?.message}</span>
                  {error && (
                    <button
                      className="text-link"
                      onClick={() => setRefresh((x) => x + 1)}
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}
              <div className="results-heading">
                <p aria-live="polite">
                  {loading ? (
                    "Finding your next breath of fresh air…"
                  ) : (
                    <>
                      <strong>
                        {visible.length}{" "}
                        {visible.length === 1 ? "place" : "places"}
                      </strong>{" "}
                      for {activityName(activity).toLowerCase()}
                    </>
                  )}
                </p>
                <span>
                  <span className="score-dot" /> Ranked by weather suitability
                </span>
              </div>
              {loading ? (
                <div className="loading-state" role="status">
                  <LoaderCircle className="spin" />
                  <p>Bringing the outdoors a little closer…</p>
                </div>
              ) : !visible.length ? (
                <div className="empty-state">
                  <Search size={32} />
                  <h3>
                    {error
                      ? "We couldn’t load the places."
                      : "No places found, yet."}
                  </h3>
                  <p>
                    {error
                      ? "Check the API is running, then try again."
                      : "Try another activity, region, or search term."}
                  </p>
                  <button
                    className="button"
                    onClick={() => {
                      setSearch("");
                      setRegion("all");
                      setRefresh((x) => x + 1);
                    }}
                  >
                    Reset & refresh
                  </button>
                </div>
              ) : (
                <>
                  {view === "map" && (
                    <LocationMap destinations={visible} onSelect={setDetail} />
                  )}
                  <div className="destination-grid">
                    {visible.map((d, i) => (
                      <article className="destination-card" key={d.id}>
                        <div className="card-photo">
                          {parkPhotos[d.id] && (
                            <img
                              className="destination-photo"
                              src={parkPhotos[d.id].src}
                              alt={parkPhotos[d.id].alt}
                              loading="lazy"
                            />
                          )}
                          <div className="photo-shade" />
                          <span className="region-pill">
                            <MapPin size={12} />
                            {d.region}
                          </span>
                          {i === 0 && d.score !== null && d.score >= 75 && (
                            <span className="top-pick">
                              <Leaf size={12} /> A good place to start
                            </span>
                          )}
                          <button
                            className="card-save"
                            aria-label={`Save a plan for ${d.name}`}
                            onClick={() => beginSave(d)}
                          >
                            <Bookmark size={18} />
                          </button>
                        </div>
                        <div className="card-body">
                          <div className="card-title-row">
                            <h3>
                              <button onClick={() => setDetail(d)}>
                                {d.name}
                              </button>
                            </h3>
                            <span
                              className={`score ${d.score === null ? "unknown" : d.score >= 75 ? "good" : d.score >= 50 ? "mixed" : "poor"}`}
                              title="Heuristic weather suitability, not a safety guarantee"
                            >
                              {d.score ?? "—"}
                              <small>/100</small>
                            </span>
                          </div>
                          <p className="card-description">{d.description}</p>
                          <div className="tags">
                            {d.tags.slice(0, 3).map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                          <div className="card-weather">
                            <span>
                              <WeatherIcon forecast={d.forecast} size={17} />
                              {d.forecast || "Forecast unavailable"}
                            </span>
                            <strong>
                              {d.temperature ? `${d.temperature.value}°C` : "—"}
                            </strong>
                          </div>
                          <div className="card-bottom">
                            <span
                              className={`verdict ${d.score !== null && d.score < 50 ? "caution" : ""}`}
                            >
                              {d.verdict}
                            </span>
                            <button
                              className="text-link"
                              onClick={() => setDetail(d)}
                            >
                              Take a look <ArrowRight size={15} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
            <section className="gentle-reminder container">
              <div className="reminder-icon">
                <TreePine size={43} />
              </div>
              <div>
                <div className="eyebrow">A SMALL REMINDER</div>
                <h2>
                  You don’t need a big adventure.
                  <br />
                  Just a little time outside.
                </h2>
              </div>
              <p>
                Pack water. Bring a friend.
                <br />
                Leave the place a little better
                <br />
                than you found it.
              </p>
              <span className="reminder-flower">✳</span>
            </section>
          </>
        ) : (
          <section className="plans-page container">
            <div className="eyebrow">LESS PLANNING. MORE DOING.</div>
            <div className="section-header">
              <div>
                <h1>Your little escapes.</h1>
                <p>A few good reasons to step outside.</p>
                <p className="browser-plans-note">
                  <Bookmark size={14} /> Saved in this browser only. Clearing
                  browser data removes these plans.
                </p>
              </div>
              <button className="button" onClick={() => setPage("explore")}>
                Find a place <ArrowRight size={17} />
              </button>
            </div>
            {plansError ? (
              <div className="alert storage-alert" role="alert">
                <Info size={19} />
                <div>
                  <p>{plansError}</p>
                  <div className="storage-actions">
                    <button className="text-link" onClick={loadPlans}>
                      Try again
                    </button>
                    <button className="text-link" onClick={resetPlans}>
                      Reset saved plans in this browser
                    </button>
                  </div>
                </div>
              </div>
            ) : plans.length === 0 ? (
              <div className="empty-state">
                <Sprout size={38} />
                <h2>A little space for possibility.</h2>
                <p>No saved plans yet. Find a place and make it a date.</p>
                <button className="button" onClick={() => setPage("explore")}>
                  Explore places <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="plan-list">
                {[...plans]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((p) => (
                    <article className="plan-item" key={p.id}>
                      <div className="plan-date">
                        <CalendarDays size={23} />
                        <span>{dateLabel(p.date)}</span>
                      </div>
                      <div className="plan-content">
                        <small>{activityName(p.activity)}</small>
                        <h2>{p.destinationName}</h2>
                        {p.notes && <p>{p.notes}</p>}
                        <span className="muted">
                          Weather is checked when you explore, not reserved for
                          this date.
                        </span>
                      </div>
                      <button
                        className="button button-outline small"
                        onClick={() => void removePlan(p.id)}
                      >
                        Remove
                      </button>
                    </article>
                  ))}
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="site-footer container">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("explore");
          }}
        >
          outside<span className="brand-country">SINGAPORE</span>
        </a>
        <p>A little help from public data. A lot to explore.</p>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)} wide>
          <div className="detail-location">
            <MapPin size={16} />
            {detail.region} Singapore · Curated outdoor destination
          </div>
          <p className="detail-description">{detail.description}</p>
          <div className="detail-score">
            <div className="large-score">
              {detail.score ?? "—"}
              <small>/100</small>
            </div>
            <div>
              <strong>{detail.verdict}</strong>
              <p>
                A transparent weather suitability estimate for{" "}
                {activityName(activity).toLowerCase()}.
              </p>
            </div>
          </div>
          <h3>Why this recommendation?</h3>
          <ul className="reasons">
            {detail.reasons.map((r, i) => (
              <li key={i}>
                <Info size={16} />
                {r}
              </li>
            ))}
          </ul>
          <div className="forecast-box">
            <WeatherIcon forecast={detail.forecast} size={28} />
            <div>
              <strong>{detail.forecast || "Forecast unavailable"}</strong>
              <p>
                {detail.forecastArea
                  ? `Forecast area: ${detail.forecastArea}`
                  : "No nearby forecast available"}
                {data?.forecastWindow &&
                  ` · ${time(data.forecastWindow.start)}–${time(data.forecastWindow.end)} SGT`}
              </p>
            </div>
          </div>
          <h3>Nearby observations</h3>
          <p className="muted">
            Measured at stations, not at this destination. These are
            observations, not forecasts.
          </p>
          <div className="station-grid">
            <StationReading
              label="Air temperature"
              reading={detail.temperature}
              unit="°C"
            />
            <StationReading
              label="Relative humidity"
              reading={detail.humidity}
              unit="%"
            />
            <StationReading
              label="Rainfall · latest interval"
              reading={detail.rainfall}
              unit="mm"
            />
          </div>
          <p className="detail-caution">
            A suitability score is a planning aid, not a safety assessment.
            Check official weather warnings and local conditions before setting
            out.
          </p>
          <div className="modal-actions">
            <a
              className="button button-outline"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detail.mapLocation.name)}&query_place_id=${encodeURIComponent(detail.mapLocation.placeId)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Maps <MapPin size={16} />
            </a>
            <button className="button" onClick={() => beginSave(detail)}>
              Make a plan <Bookmark size={17} />
            </button>
          </div>
        </Modal>
      )}
      {saving && (
        <SaveModal
          destination={saving}
          activity={activity}
          onClose={() => setSaving(null)}
          onSaved={(updatedPlans) => {
            setPlans(updatedPlans);
            setPlansError("");
            setSaving(null);
            setNotice(
              "A little escape, saved in this browser. Find it in My plans.",
            );
          }}
        />
      )}

    </>
  );
}
function ArrowUpRight() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}
function SaveModal({
  destination,
  activity,
  onClose,
  onSaved,
}: {
  destination: Destination;
  activity: Activity;
  onClose: () => void;
  onSaved: (plans: Plan[]) => void;
}) {
  const [date, setDate] = useState(today()),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSaved(addLocalPlan(destination, activity, date, notes));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Make a little escape." onClose={onClose}>
      <div className="save-place">
        <MapPin size={21} />
        <div>
          <strong>{destination.name}</strong>
          <span>{activityName(activity)}</span>
        </div>
      </div>
      <form className="form" onSubmit={submit}>
        <label>
          Pick a date
          <input
            type="date"
            min={today()}
            max={maxPlanDate()}
            value={date}
            required
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          A note for later <span className="muted">(optional)</span>
          <textarea
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Pack a picnic. Bring the good company."
          />
        </label>
        <p className="form-hint">
          <Info size={17} /> This saves your itinerary, not a weather forecast
          for that date. Check conditions again before heading out. Plans are
          saved in this browser only.
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button className="button full" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <>
              Save my plan <Bookmark size={17} />
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}
function LocationMap({
  destinations,
  onSelect,
}: {
  destinations: Destination[];
  onSelect: (d: Destination) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = destinations.find((d) => d.id === selectedId) ?? destinations[0];
  if (!selected) return null;
  const location = selected.mapLocation;

  return (
    <div className="location-map">
      <div className="map-label">
        <MapPin size={18} />
        <strong>{selected.name}</strong>
        <span>Select a place below to see its location</span>
      </div>
      <iframe
        className="google-map"
        key={selected.id}
        title={`Google Maps location of ${location.name}`}
        src={`https://www.google.com/maps?cid=${encodeURIComponent(location.cid)}&z=16&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <div className="map-actions">
        <span>Pin: {location.name}</span>
        <button className="text-link" onClick={() => onSelect(selected)}>
          View place <ChevronRight size={16} />
        </button>
        <a
          className="text-link"
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.name)}&destination_place_id=${encodeURIComponent(location.placeId)}`}
          target="_blank"
          rel="noreferrer"
        >
          Get directions <ArrowRight size={16} />
        </a>
      </div>
      <div className="map-key" role="group" aria-label="Choose a place on the map">
        {destinations.map((d) => (
          <button
            key={d.id}
            className={d.id === selected.id ? "selected" : ""}
            aria-pressed={d.id === selected.id}
            onClick={() => setSelectedId(d.id)}
          >
            <MapPin size={14} />
            {d.name}
          </button>
        ))}
      </div>
    </div>
  );
}
