import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./App.css";

const websiteBasePath = String(import.meta.env.BASE_URL || "/");
const adminStorageKey = "videoapp-admin-token";
const directDownloadUrl = String(import.meta.env.VITE_DIRECT_DOWNLOAD_URL || "").trim();

const defaultProduct = {
  app: {
    name: "VideoApp",
    shortName: "VA",
    tagline: "Private messaging, calls, and communities in one place.",
    description:
      "VideoApp is a premium communication stack that keeps website, mobile app, backend, and release delivery in one repository.",
  },
  hero: {
    eyebrow: "Modern communication",
    headline: "One private place for chat, calls, status, and communities.",
    body:
      "Built as a production-minded Android app and premium website with live release management, OTP auth, Socket.io, MongoDB, and polished mobile experiences.",
    downloadLabel: "Download Android App",
    webLabel: "Open Admin Console",
  },
  features: [],
  screenshots: [],
  testimonials: [],
  faq: [],
  updates: [],
  seo: {
    title: "VideoApp",
    description: "Private chat, calls, communities, and Android downloads.",
    keywords: [],
  },
  footer: {
    contactEmail: "hello@videoapp.local",
    privacyUrl: "#privacy",
    termsUrl: "#terms",
    socialLinks: [],
  },
};

const defaultRelease = {
  version: "1.0.0",
  buildNumber: 1,
  channel: "production",
  minimumSupportedBuildNumber: 1,
  releaseNotes: [],
  publishedAt: "",
  appSizeLabel: "",
  fileName: "",
  apkUrl: "",
  relativeWebsiteDownloadPath: "",
  downloadUrl: "",
  source: "bundled",
  downloadCount: 0,
};

const defaultStats = {
  onlineUsersCount: 0,
  communitiesCount: 0,
  groupsCount: 0,
  totalDownloads: 0,
};

const readSessionToken = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(adminStorageKey) || "";
};

const withBasePath = (value) => {
  if (!value) {
    return websiteBasePath;
  }

  if (/^(https?:)?\/\//i.test(value)) {
    return value;
  }

  const normalizedBase = websiteBasePath.endsWith("/") ? websiteBasePath : `${websiteBasePath}/`;
  const normalizedValue = String(value).replace(/^\/+/, "");
  return `${normalizedBase}${normalizedValue}`;
};

const stripBasePath = (pathname) => {
  const normalizedBase = websiteBasePath.replace(/\/+$/, "");

  if (!normalizedBase || normalizedBase === "/") {
    return pathname || "/";
  }

  if (!pathname.startsWith(normalizedBase)) {
    return pathname || "/";
  }

  const strippedPath = pathname.slice(normalizedBase.length) || "/";
  return strippedPath.startsWith("/") ? strippedPath : `/${strippedPath}`;
};

const getCurrentRoute = () => {
  if (typeof window === "undefined") {
    return "/";
  }

  return stripBasePath(window.location.pathname || "/");
};

const isLoopbackHostname = (hostname = "") => {
  const normalizedHostname = String(hostname || "").trim().toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1" ||
    normalizedHostname === "[::1]"
  );
};

const isPrivateIpv4Hostname = (hostname = "") => {
  const normalizedHostname = String(hostname || "").trim();

  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalizedHostname)) {
    return false;
  }

  const octets = normalizedHostname.split(".").map((segment) => Number(segment));

  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254)
  );
};

const isLanHostname = (hostname = "") => {
  const normalizedHostname = String(hostname || "").trim().toLowerCase();
  return isPrivateIpv4Hostname(normalizedHostname) || normalizedHostname.endsWith(".local");
};

const rewriteLoopbackUrlForCurrentClient = (rawUrl) => {
  if (!rawUrl || typeof window === "undefined") {
    return String(rawUrl || "").trim();
  }

  try {
    const targetUrl = new URL(rawUrl);
    const currentHostname = String(window.location.hostname || "").trim().toLowerCase();

    if (!isLoopbackHostname(targetUrl.hostname) || !currentHostname) {
      return targetUrl.toString().replace(/\/+$/, "");
    }

    if (isLoopbackHostname(currentHostname)) {
      return targetUrl.toString().replace(/\/+$/, "");
    }

    if (isLanHostname(currentHostname)) {
      targetUrl.hostname = currentHostname;
      return targetUrl.toString().replace(/\/+$/, "");
    }

    return "";
  } catch {
    return String(rawUrl || "").trim();
  }
};

const resolveApiBaseUrl = () => {
  const configuredUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

  if (configuredUrl) {
    const rewrittenConfiguredUrl = rewriteLoopbackUrlForCurrentClient(configuredUrl);

    if (rewrittenConfiguredUrl) {
      return rewrittenConfiguredUrl;
    }
  }

  if (typeof window === "undefined") {
    return "";
  }

  const { hostname, protocol } = window.location;

  if (isLoopbackHostname(hostname)) {
    return "http://localhost:5173";
  }

  if (isLanHostname(hostname)) {
    return `${protocol}//${hostname}:5173`;
  }

  if (hostname.startsWith("www.")) {
    return `${protocol}//api.${hostname.replace(/^www\./, "")}`;
  }

  if (hostname) {
    const currentPort = window.location.port ? `:${window.location.port}` : "";
    return `${protocol}//${hostname}${currentPort}`.replace(/\/+$/, "");
  }

  return "";
};

const mergeProduct = (payload) => ({
  ...defaultProduct,
  ...payload,
  app: {
    ...defaultProduct.app,
    ...(payload?.app || {}),
  },
  hero: {
    ...defaultProduct.hero,
    ...(payload?.hero || {}),
  },
  seo: {
    ...defaultProduct.seo,
    ...(payload?.seo || {}),
  },
  footer: {
    ...defaultProduct.footer,
    ...(payload?.footer || {}),
  },
});

const formatDate = (value) => {
  if (!value) {
    return "Ready to publish";
  }

  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
};

const formatDateTime = (value) => {
  if (!value) {
    return "Not available";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const buildAbsoluteUrl = (value) => {
  if (!value || typeof window === "undefined") {
    return value || "";
  }

  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
};

const buildTrackedDownloadUrl = (apiBaseUrl, channel = defaultRelease.channel) => {
  const normalizedApiBaseUrl = String(apiBaseUrl || "").trim().replace(/\/+$/, "");

  if (!normalizedApiBaseUrl) {
    return "";
  }

  try {
    const targetUrl = new URL(`${normalizedApiBaseUrl}/downloads/latest.apk`);
    const normalizedChannel = String(channel || defaultRelease.channel).trim().toLowerCase();

    if (normalizedChannel && normalizedChannel !== defaultRelease.channel) {
      targetUrl.searchParams.set("channel", normalizedChannel);
    }

    return targetUrl.toString();
  } catch {
    return `${normalizedApiBaseUrl}/downloads/latest.apk`;
  }
};

const normalizeRelease = (
  payload = {},
  { apiBaseUrl = "", allowTrackedDownloadFallback = false } = {}
) => {
  const relativeWebsiteDownloadPath = String(
    payload.relativeWebsiteDownloadPath || payload.relativeDownloadPath || ""
  ).trim();
  const channel = String(payload.channel || defaultRelease.channel).trim().toLowerCase()
    || defaultRelease.channel;
  const explicitDownloadUrl = String(payload.downloadUrl || payload.apkUrl || "").trim();
  const trackedDownloadUrl = allowTrackedDownloadFallback
    ? buildTrackedDownloadUrl(apiBaseUrl, channel)
    : "";

  return {
    ...defaultRelease,
    ...payload,
    channel,
    apkUrl: String(payload.apkUrl || "").trim(),
    relativeWebsiteDownloadPath,
    downloadUrl: explicitDownloadUrl || trackedDownloadUrl || directDownloadUrl,
  };
};

const loadBundledReleaseMetadata = async ({ apiBaseUrl = "" } = {}) => {
  const payload = await requestJson(withBasePath("/downloads/release.json"));
  return normalizeRelease(payload, {
    apiBaseUrl,
    allowTrackedDownloadFallback: false,
  });
};

const getReleaseDownloadHref = (release) => {
  if (release?.relativeWebsiteDownloadPath) {
    return withBasePath(release.relativeWebsiteDownloadPath);
  }

  return String(release?.downloadUrl || release?.apkUrl || directDownloadUrl || "").trim();
};

const setMetaTag = (selector, attribute, content) => {
  if (typeof document === "undefined") {
    return;
  }

  let node = document.head.querySelector(selector);

  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attribute, selector.includes("property=") ? selector.match(/property=\"([^\"]+)\"/)?.[1] || "" : selector.match(/name=\"([^\"]+)\"/)?.[1] || "");
    document.head.appendChild(node);
  }

  node.setAttribute("content", content);
};

const applySeo = ({ title, description, keywords, path }) => {
  if (typeof document === "undefined") {
    return;
  }

  const canonicalUrl = typeof window !== "undefined" ? buildAbsoluteUrl(withBasePath(path)) : "";
  document.title = title;
  setMetaTag('meta[name="description"]', "name", description);
  setMetaTag('meta[property="og:title"]', "property", title);
  setMetaTag('meta[property="og:description"]', "property", description);
  setMetaTag('meta[property="og:type"]', "property", "website");

  if (canonicalUrl) {
    setMetaTag('meta[property="og:url"]', "property", canonicalUrl);
    let canonicalNode = document.head.querySelector('link[rel="canonical"]');

    if (!canonicalNode) {
      canonicalNode = document.createElement("link");
      canonicalNode.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalNode);
    }

    canonicalNode.setAttribute("href", canonicalUrl);
  }

  if (Array.isArray(keywords) && keywords.length > 0) {
    setMetaTag('meta[name="keywords"]', "name", keywords.join(", "));
  }
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with ${response.status}`);
  }

  return data;
};

const MarketingPage = ({
  product,
  release,
  stats,
  announcement,
  status,
  errorMessage,
  onNavigate,
}) => {
  const [activeShotIndex, setActiveShotIndex] = useState(0);

  useEffect(() => {
    if (product.screenshots.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveShotIndex((currentIndex) => (currentIndex + 1) % product.screenshots.length);
    }, 4200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [product.screenshots.length]);

  const activeShot = product.screenshots[activeShotIndex] || null;
  const downloadHref = getReleaseDownloadHref(release);
  const hasDownload = Boolean(downloadHref);
  const qrValue = buildAbsoluteUrl(withBasePath("/#download"));

  return (
    <div className="site-shell">
      <header className="topbar">
        <button className="brand button-reset" onClick={() => onNavigate("/")}>
          <span className="brand-mark">{product.app.shortName}</span>
          <span className="brand-copy">
            <strong>{product.app.name}</strong>
            <span>{product.app.tagline}</span>
          </span>
        </button>

        <nav className="nav-links" aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#download">Download</a>
          <button className="button-reset" onClick={() => onNavigate("/updates")}>
            Updates
          </button>
          <button className="button-reset" onClick={() => onNavigate("/admin/login")}>
            Admin
          </button>
        </nav>
      </header>

      {announcement ? (
        <section className={`announcement-banner announcement-${announcement.level || "info"}`}>
          <strong>{announcement.title}</strong>
          <span>{announcement.message}</span>
        </section>
      ) : null}

      <main className="page">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">{product.hero.eyebrow}</span>
            <h1>{product.hero.headline}</h1>
            <p>{product.hero.body}</p>

            <div className="hero-actions">
              {hasDownload ? (
                <a className="button button-primary" href={downloadHref}>
                  {product.hero.downloadLabel}
                </a>
              ) : (
                <button className="button button-primary" disabled>
                  Release metadata required
                </button>
              )}
              <button className="button button-secondary" onClick={() => onNavigate("/admin/login")}>
                {product.hero.webLabel}
              </button>
            </div>

            <div className="hero-stats">
              <div className="stat-card">
                <span>Online now</span>
                <strong>{stats.onlineUsersCount}</strong>
              </div>
              <div className="stat-card">
                <span>Downloads</span>
                <strong>{stats.totalDownloads}</strong>
              </div>
              <div className="stat-card">
                <span>Latest version</span>
                <strong>{release.version}</strong>
              </div>
              <div className="stat-card">
                <span>Communities</span>
                <strong>{stats.communitiesCount}</strong>
              </div>
            </div>

            <div className="live-row">
              <span className={`live-pill ${status === "ready" ? "is-live" : "is-waiting"}`}>
                {status === "ready" ? "Live backend sync" : "Static fallback active"}
              </span>
              <span className="status-copy">
                {release.minimumSupportedBuildNumber > 1
                  ? `Force update supported from build ${release.minimumSupportedBuildNumber}.`
                  : "Direct APK delivery and changelog publishing are ready."}
              </span>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-phone">
              <span className="mini-label">Current release</span>
              <strong>v{release.version}</strong>
              <span>Build {release.buildNumber}</span>
              <span>Published {formatDate(release.publishedAt)}</span>
              <div className="hero-phone-lines">
                {(release.releaseNotes.length > 0 ? release.releaseNotes : [
                  "Publish a release to show live changelog notes here.",
                ]).slice(0, 3).map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            </div>
            <div className="hero-side-card">
              <span className="mini-label">Release source</span>
              <strong>{release.source === "bundled" ? "Bundled APK" : "Tracked backend"}</strong>
              <span>{release.appSizeLabel || "Size appears after APK sync"}</span>
            </div>
          </div>
        </section>

        <section className="section" id="features">
          <div className="section-heading">
            <span className="eyebrow">Feature System</span>
            <h2>Real product surfaces, not launch-day placeholders</h2>
            <p>
              Website, mobile, and backend now expose the operational pieces real users need:
              moderation, releases, download telemetry, live counters, and update readiness.
            </p>
          </div>

          <div className="feature-grid">
            {product.features.map((feature) => (
              <article key={feature.id} className="feature-card">
                <span className="feature-index">{feature.title}</span>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section screenshots-section">
          <div className="section-heading">
            <span className="eyebrow">Screenshots</span>
            <h2>Carousel previews that keep the app story moving</h2>
            <p>
              The screenshot carousel showcases chat, calls, status, and communities instead of
              relying on static placeholders.
            </p>
          </div>

          {activeShot ? (
            <div className="carousel-shell">
              <article className={`screenshot-card screenshot-card-${activeShot.kind}`}>
                <span className="screenshot-tag">{activeShot.title}</span>
                <strong>{activeShot.subtitle}</strong>
                <div className="screenshot-lines">
                  {activeShot.lines.map((line) => (
                    <span key={`${activeShot.id}-${line}`}>{line}</span>
                  ))}
                </div>
              </article>

              <div className="carousel-dots">
                {product.screenshots.map((shot, index) => (
                  <button
                    key={shot.id}
                    className={`carousel-dot ${index === activeShotIndex ? "is-active" : ""}`}
                    onClick={() => setActiveShotIndex(index)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="section download-section" id="download">
          <div className="download-panel">
            <div className="download-copy">
              <span className="eyebrow">Android Download</span>
              <h2>Live APK delivery with versioning, changelog, and QR handoff</h2>
              <p>
                Users can see the current Android version, published date, minimum supported build,
                and changelog before they install.
              </p>

              <div className="download-metadata">
                <div>
                  <span>Version</span>
                  <strong>{release.version}</strong>
                </div>
                <div>
                  <span>Build</span>
                  <strong>{release.buildNumber}</strong>
                </div>
                <div>
                  <span>Downloads</span>
                  <strong>{stats.totalDownloads}</strong>
                </div>
                <div>
                  <span>Published</span>
                  <strong>{formatDate(release.publishedAt)}</strong>
                </div>
              </div>

              <div className="download-actions">
                {hasDownload ? (
                  <a className="button button-primary" href={downloadHref}>
                    Direct APK Download
                  </a>
                ) : (
                  <button className="button button-primary" disabled>
                    Add APK to activate download
                  </button>
                )}
                <button className="button button-secondary" onClick={() => onNavigate("/updates")}>
                  View updates
                </button>
              </div>

              <div className="release-notes">
                <h3>Changelog</h3>
                <ul>
                  {(release.releaseNotes.length > 0
                    ? release.releaseNotes
                    : ["Publish a release into shared/releases/android to replace this placeholder."]).map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>

              {errorMessage ? <p className="helper-text">{errorMessage}</p> : null}
            </div>

            <div className="qr-card">
              <span className="eyebrow">QR Download</span>
              <div className="qr-shell">
                <QRCodeSVG
                  value={qrValue}
                  size={172}
                  bgColor="transparent"
                  fgColor="#0f3828"
                  level="M"
                  includeMargin
                />
              </div>
              <strong>Scan to open the current Android release</strong>
              <p>The QR code opens the website download section so users can tap the APK button after scanning.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <span className="eyebrow">Testimonials</span>
            <h2>Early operators needed the product surface to do more than look polished</h2>
          </div>

          <div className="testimonial-grid">
            {product.testimonials.map((testimonial) => (
              <article key={testimonial.id} className="testimonial-card">
                <p>"{testimonial.quote}"</p>
                <strong>{testimonial.name}</strong>
                <span>{testimonial.role}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section faq-section">
          <div className="section-heading">
            <span className="eyebrow">FAQ</span>
            <h2>Answers for launch, support, and release operations</h2>
          </div>

          <div className="faq-list">
            {product.faq.map((item) => (
              <details key={item.id} className="faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <span className="eyebrow">Updates</span>
            <h2>Blog-style release notes and launch updates</h2>
            <p>
              Keep shipping notes, release announcements, and rollout context on a dedicated page
              instead of burying it in the repo.
            </p>
          </div>

          <div className="update-grid">
            {product.updates.slice(0, 3).map((update) => (
              <article key={update.id} className="update-card">
                <span>{formatDate(update.date)}</span>
                <strong>{update.title}</strong>
                <p>{update.summary}</p>
              </article>
            ))}
          </div>

          <div className="section-actions">
            <button className="button button-secondary" onClick={() => onNavigate("/updates")}>
              Open updates page
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <strong>{product.app.name}</strong>
          <p>{product.app.description}</p>
          <a href={`mailto:${product.footer.contactEmail}`}>{product.footer.contactEmail}</a>
        </div>

        <div className="footer-links">
          <a href={product.footer.privacyUrl}>Privacy policy</a>
          <a href={product.footer.termsUrl}>Terms</a>
          {product.footer.socialLinks.map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
};

const UpdatesPage = ({ product, release, onNavigate }) => (
  <div className="site-shell page-single">
    <header className="topbar">
      <button className="brand button-reset" onClick={() => onNavigate("/")}>
        <span className="brand-mark">{product.app.shortName}</span>
        <span className="brand-copy">
          <strong>{product.app.name}</strong>
          <span>{product.app.tagline}</span>
        </span>
      </button>

      <nav className="nav-links" aria-label="Secondary">
        <button className="button-reset" onClick={() => onNavigate("/")}>
          Home
        </button>
        <button className="button-reset" onClick={() => onNavigate("/admin/login")}>
          Admin
        </button>
      </nav>
    </header>

    <main className="page">
      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">Updates</span>
          <h1 className="page-title">Release notes, launch logs, and product updates</h1>
          <p>
            Keep users and operators aligned with a dedicated update stream tied to the live Android
            release metadata.
          </p>
        </div>

        <div className="update-timeline">
          <article className="timeline-card timeline-card-highlight">
            <span className="timeline-date">{formatDate(release.publishedAt)}</span>
            <strong>Latest Android release v{release.version}</strong>
            <p>
              Build {release.buildNumber} is currently live. Minimum supported build is{" "}
              {release.minimumSupportedBuildNumber}.
            </p>
            <ul>
              {(release.releaseNotes.length > 0 ? release.releaseNotes : ["No release notes published yet."]).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>

          {product.updates.map((update) => (
            <article key={update.id} className="timeline-card">
              <span className="timeline-date">{formatDate(update.date)}</span>
              <strong>{update.title}</strong>
              <p>{update.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  </div>
);

const AdminLoginPage = ({ apiBaseUrl, onLogin, onNavigate }) => {
  const [email, setEmail] = useState("admin@videoapp.local");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!apiBaseUrl) {
      setErrorMessage("Set VITE_API_BASE_URL so the website can reach the backend admin API.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const payload = await requestJson(`${apiBaseUrl}/admin/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      onLogin(payload.token);
      onNavigate("/admin");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="site-shell page-single">
      <header className="topbar">
        <button className="brand button-reset" onClick={() => onNavigate("/")}>
          <span className="brand-mark">VA</span>
          <span className="brand-copy">
            <strong>VideoApp</strong>
            <span>Admin access</span>
          </span>
        </button>
      </header>

      <main className="page">
        <section className="auth-shell">
          <form className="auth-card" onSubmit={handleSubmit}>
            <span className="eyebrow">Admin Login</span>
            <h1>Secure operator access</h1>
            <p>Use the configured admin credentials to open the moderation and release dashboard.</p>

            <label>
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
            </label>

            <label>
              <span>Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </label>

            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Open dashboard"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

const AdminDashboard = ({ apiBaseUrl, token, onLogout, onNavigate }) => {
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [logs, setLogs] = useState([]);
  const [releases, setReleases] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [releaseForm, setReleaseForm] = useState({
    version: "",
    buildNumber: "",
    apkUrl: "",
    minimumSupportedBuildNumber: "",
    releaseNotes: "",
  });

  const adminRequest = async (path, options = {}) => {
    if (!apiBaseUrl) {
      throw new Error("Set VITE_API_BASE_URL before using the admin dashboard.");
    }

    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    if (!headers.has("Content-Type") && options.method && options.method !== "GET") {
      headers.set("Content-Type", "application/json");
    }

    return requestJson(`${apiBaseUrl}${path}`, {
      ...options,
      headers,
    });
  };

  const loadDashboard = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [overviewPayload, usersPayload, reportsPayload, logsPayload, releasesPayload, announcementPayload] =
        await Promise.all([
          adminRequest("/admin/overview"),
          adminRequest("/admin/users"),
          adminRequest("/admin/reports"),
          adminRequest("/admin/logs"),
          adminRequest("/admin/releases"),
          adminRequest("/admin/announcements"),
        ]);

      setDashboard(overviewPayload);
      setUsers(usersPayload.users || []);
      setReports(reportsPayload.reports || []);
      setLogs(logsPayload.logs || []);
      setReleases(releasesPayload.releases || []);
      setAnnouncements(announcementPayload.announcements || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load dashboard.";

      if (/401|403|token/i.test(message)) {
        onLogout();
        onNavigate("/admin/login");
        return;
      }

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleBanToggle = async (userId, isBanned) => {
    try {
      await adminRequest(`/admin/users/${userId}/${isBanned ? "unban" : "ban"}`, {
        method: "PATCH",
        body: JSON.stringify(
          isBanned
            ? {}
            : {
                reason: "Suspended from admin dashboard",
              }
        ),
      });
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update user.");
    }
  };

  const handleBroadcast = async (event) => {
    event.preventDefault();

    try {
      await adminRequest("/admin/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          level: "info",
        }),
      });
      setBroadcastTitle("");
      setBroadcastMessage("");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to publish announcement.");
    }
  };

  const handleReleasePublish = async (event) => {
    event.preventDefault();

    try {
      await adminRequest("/admin/releases", {
        method: "POST",
        body: JSON.stringify({
          version: releaseForm.version,
          buildNumber: Number(releaseForm.buildNumber),
          apkUrl: releaseForm.apkUrl,
          minimumSupportedBuildNumber: Number(
            releaseForm.minimumSupportedBuildNumber || releaseForm.buildNumber
          ),
          releaseNotes: releaseForm.releaseNotes
            .split(/\r?\n/)
            .map((entry) => entry.trim())
            .filter(Boolean),
        }),
      });
      setReleaseForm({
        version: "",
        buildNumber: "",
        apkUrl: "",
        minimumSupportedBuildNumber: "",
        releaseNotes: "",
      });
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to publish release.");
    }
  };

  const statCards = dashboard?.stats
    ? [
        { label: "Users", value: dashboard.stats.totalUsers },
        { label: "Active users", value: dashboard.stats.activeUsersLive || dashboard.stats.activeUsers },
        { label: "Messages", value: dashboard.stats.totalMessages },
        { label: "APK downloads", value: dashboard.stats.apkDownloads },
        { label: "Open reports", value: dashboard.stats.openReports },
        { label: "Errors", value: dashboard.stats.errorLogCount },
      ]
    : [];

  return (
    <div className="site-shell page-single">
      <header className="topbar">
        <button className="brand button-reset" onClick={() => onNavigate("/")}>
          <span className="brand-mark">VA</span>
          <span className="brand-copy">
            <strong>VideoApp Admin</strong>
            <span>Moderation, releases, and operations</span>
          </span>
        </button>

        <nav className="nav-links" aria-label="Admin">
          <button className="button-reset" onClick={loadDashboard}>
            Refresh
          </button>
          <button className="button-reset" onClick={onLogout}>
            Sign out
          </button>
        </nav>
      </header>

      <main className="page">
        {errorMessage ? <p className="form-error dashboard-error">{errorMessage}</p> : null}

        <section className="section">
          <div className="section-heading">
            <span className="eyebrow">Admin Dashboard</span>
            <h1 className="page-title">Production operations at a glance</h1>
            <p>Track active users, moderation activity, release state, and recent backend failures.</p>
          </div>

          {loading ? (
            <div className="loading-card">Loading dashboard...</div>
          ) : (
            <div className="admin-stat-grid">
              {statCards.map((card) => (
                <article key={card.label} className="stat-card">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="section dashboard-grid">
          <article className="dashboard-panel">
            <div className="panel-heading">
              <h2>Announcements</h2>
              <span>{announcements.length} recent</span>
            </div>

            <form className="dashboard-form" onSubmit={handleBroadcast}>
              <input
                value={broadcastTitle}
                onChange={(event) => setBroadcastTitle(event.target.value)}
                placeholder="Announcement title"
              />
              <textarea
                value={broadcastMessage}
                onChange={(event) => setBroadcastMessage(event.target.value)}
                placeholder="Broadcast a message to live clients"
                rows={4}
              />
              <button className="button button-primary" type="submit">
                Broadcast
              </button>
            </form>

            <div className="dashboard-list">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="list-card">
                  <strong>{announcement.title}</strong>
                  <p>{announcement.message}</p>
                  <span>{formatDateTime(announcement.createdAt)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="panel-heading">
              <h2>Release management</h2>
              <span>{releases.length} tracked</span>
            </div>

            <form className="dashboard-form" onSubmit={handleReleasePublish}>
              <input
                value={releaseForm.version}
                onChange={(event) =>
                  setReleaseForm((current) => ({ ...current, version: event.target.value }))
                }
                placeholder="Version"
              />
              <input
                value={releaseForm.buildNumber}
                onChange={(event) =>
                  setReleaseForm((current) => ({ ...current, buildNumber: event.target.value }))
                }
                placeholder="Build number"
              />
              <input
                value={releaseForm.minimumSupportedBuildNumber}
                onChange={(event) =>
                  setReleaseForm((current) => ({
                    ...current,
                    minimumSupportedBuildNumber: event.target.value,
                  }))
                }
                placeholder="Minimum supported build"
              />
              <input
                value={releaseForm.apkUrl}
                onChange={(event) =>
                  setReleaseForm((current) => ({ ...current, apkUrl: event.target.value }))
                }
                placeholder="https://..."
              />
              <textarea
                value={releaseForm.releaseNotes}
                onChange={(event) =>
                  setReleaseForm((current) => ({ ...current, releaseNotes: event.target.value }))
                }
                placeholder="One changelog item per line"
                rows={5}
              />
              <button className="button button-primary" type="submit">
                Publish release
              </button>
            </form>

            <div className="dashboard-list">
              {releases.map((release) => (
                <div key={`${release.version}-${release.buildNumber}`} className="list-card">
                  <strong>
                    v{release.version} build {release.buildNumber}
                  </strong>
                  <p>
                    {release.releaseNotes[0] || "No changelog summary yet."}
                  </p>
                  <span>
                    {release.downloadCount} downloads • min build {release.minimumSupportedBuildNumber}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="section dashboard-grid">
          <article className="dashboard-panel">
            <div className="panel-heading">
              <h2>Reported users</h2>
              <span>{reports.length} reports</span>
            </div>

            <div className="dashboard-list">
              {reports.map((report) => (
                <div key={report.id} className="list-card">
                  <strong>
                    {report.reportedUserId?.name || "Unknown user"} • {report.reason}
                  </strong>
                  <p>{report.details || "No extra details provided."}</p>
                  <span>
                    Reported by {report.reporterId?.name || "Unknown"} on{" "}
                    {formatDateTime(report.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="panel-heading">
              <h2>User management</h2>
              <span>{users.length} recent users</span>
            </div>

            <div className="dashboard-list">
              {users.map((user) => (
                <div key={user.id} className="list-card list-card-action">
                  <div>
                    <strong>{user.name || user.phone}</strong>
                    <p>{user.about || "No bio yet."}</p>
                    <span>
                      {user.status} • {user.isBanned ? `Banned: ${user.banReason || "yes"}` : "Active"}
                    </span>
                  </div>

                  <button
                    className={`button ${user.isBanned ? "button-secondary" : "button-danger"}`}
                    onClick={() => handleBanToggle(user.id, Boolean(user.isBanned))}
                  >
                    {user.isBanned ? "Unban" : "Ban"}
                  </button>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="section">
          <div className="panel-heading">
            <h2>Error logs</h2>
            <span>{logs.length} recent entries</span>
          </div>

          <div className="dashboard-list">
            {logs.map((log) => (
              <div key={log.id} className="list-card">
                <strong>
                  {log.method} {log.path} • {log.statusCode}
                </strong>
                <p>{log.message}</p>
                <span>
                  {formatDateTime(log.createdAt)} • request {log.requestId || "n/a"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

const App = () => {
  const [route, setRoute] = useState(getCurrentRoute());
  const [product, setProduct] = useState(defaultProduct);
  const [release, setRelease] = useState(defaultRelease);
  const [stats, setStats] = useState(defaultStats);
  const [announcement, setAnnouncement] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [adminToken, setAdminToken] = useState(readSessionToken);
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);

  const navigate = (targetPath) => {
    const nextPath = withBasePath(targetPath);
    window.history.pushState({}, "", nextPath);
    setRoute(getCurrentRoute());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getCurrentRoute());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadLocalProduct = async () => {
      try {
        const response = await fetch(withBasePath("/data/product.json"));

        if (!response.ok) {
          return;
        }

        const payload = await response.json();

        if (isMounted) {
          setProduct(mergeProduct(payload));
        }
      } catch {
        // Static product config is optional during local development.
      }
    };

    void loadLocalProduct();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadOverview = async () => {
      try {
        if (apiBaseUrl) {
          try {
            const payload = await requestJson(`${apiBaseUrl}/site/overview`);

            if (!isMounted) {
              return;
            }

            if (payload.product) {
              setProduct(mergeProduct(payload.product));
            }

            if (payload.release) {
              setRelease(normalizeRelease(payload.release, { apiBaseUrl }));
            }

            if (payload.stats) {
              setStats({
                ...defaultStats,
                ...payload.stats,
              });
            }

            setAnnouncement(payload.announcement || null);
            setStatus("ready");
            setErrorMessage("");
            return;
          } catch {
            try {
              const releasePayload = await requestJson(`${apiBaseUrl}/downloads/latest`);

              if (!isMounted) {
                return;
              }

              if (releasePayload.release) {
                setRelease(
                  normalizeRelease(releasePayload.release, {
                    apiBaseUrl,
                    allowTrackedDownloadFallback: true,
                  })
                );
                setStatus("ready");
                setErrorMessage("");
                return;
              }
            } catch {
              const fallbackRelease = await loadBundledReleaseMetadata({ apiBaseUrl });

              if (!isMounted) {
                return;
              }

              setRelease(fallbackRelease);
              setStatus("bundled");
              setErrorMessage("");
              return;
            }
          }
        }

        const fallbackRelease = await loadBundledReleaseMetadata({ apiBaseUrl });

        if (!isMounted) {
          return;
        }

        setRelease(fallbackRelease);
        setStatus("bundled");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Unable to load release metadata.");
      }
    };

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const shouldOpenDownloadSection =
      route === "/download" || String(window.location.hash || "").toLowerCase() === "#download";

    if (!shouldOpenDownloadSection) {
      return undefined;
    }

    const scrollToDownloadSection = () => {
      const downloadSection = document.getElementById("download");

      if (downloadSection) {
        downloadSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    };

    const timeoutId = window.setTimeout(scrollToDownloadSection, 120);
    scrollToDownloadSection();

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [route, status, release.downloadUrl, release.relativeWebsiteDownloadPath]);

  useEffect(() => {
    const title =
      route === "/updates"
        ? `${product.app.name} Updates`
        : route.startsWith("/admin")
          ? `${product.app.name} Admin`
          : product.seo.title;
    const description =
      route === "/updates"
        ? `Latest ${product.app.name} releases, changelogs, and launch updates.`
        : route.startsWith("/admin")
          ? `${product.app.name} admin dashboard for moderation, releases, and operations.`
          : product.seo.description;

    applySeo({
      title,
      description,
      keywords: product.seo.keywords,
      path: route,
    });
  }, [product, route]);

  const handleAdminLogin = (token) => {
    setAdminToken(token);
    window.sessionStorage.setItem(adminStorageKey, token);
  };

  const handleAdminLogout = () => {
    setAdminToken("");
    window.sessionStorage.removeItem(adminStorageKey);
  };

  if (route === "/updates") {
    return <UpdatesPage product={product} release={release} onNavigate={navigate} />;
  }

  if (route === "/admin" || route === "/admin/login") {
    if (!adminToken || route === "/admin/login") {
      return (
        <AdminLoginPage
          apiBaseUrl={apiBaseUrl}
          onLogin={handleAdminLogin}
          onNavigate={navigate}
        />
      );
    }

    return (
      <AdminDashboard
        apiBaseUrl={apiBaseUrl}
        token={adminToken}
        onLogout={() => {
          handleAdminLogout();
          navigate("/admin/login");
        }}
        onNavigate={navigate}
      />
    );
  }

  return (
    <MarketingPage
      product={product}
      release={release}
      stats={stats}
      announcement={announcement}
      status={status}
      errorMessage={errorMessage}
      onNavigate={navigate}
    />
  );
};

export default App;
