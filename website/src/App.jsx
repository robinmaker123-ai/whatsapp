import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

const defaultRelease = {
  version: "1.0.0",
  buildNumber: 1,
  minimumSupportedBuildNumber: 1,
  releaseNotes: [
    "OTP sign in with private contact matching",
    "Real-time chat, status, and call signaling",
    "Android APK delivery from a shareable website link",
  ],
  downloadCount: 0,
  publishedAt: "",
};

const featureCards = [
  {
    eyebrow: "Chat",
    title: "Private one-to-one messaging",
    copy:
      "Delivered and seen states, typing signals, media uploads, reply threads, and presence all come from the real backend.",
  },
  {
    eyebrow: "Calls",
    title: "Voice and video call flow",
    copy:
      "Call history, ringing state, answer controls, and signaling are wired through Socket.io so the app feels production-ready from the first tap.",
  },
  {
    eyebrow: "Status",
    title: "Stories that expire in 24 hours",
    copy:
      "Text and media statuses are stored on the server, synced to the app, and tracked with viewer history.",
  },
  {
    eyebrow: "Privacy",
    title: "Contact sync without uploading raw address books",
    copy:
      "The Android app hashes normalized phone numbers locally, sends only hashes to the backend, and receives matches plus invite suggestions.",
  },
  {
    eyebrow: "Download",
    title: "APK delivery from a website link",
    copy:
      "Users can visit the public website, tap the download button, and install the latest VideoApp APK on Android.",
  },
  {
    eyebrow: "Deployment",
    title: "Ready for GitHub and server deploys",
    copy:
      "The public site is static-ready while the backend stays portable for Render, Railway, Netlify functions, Vercel frontends, or your own VPS.",
  },
];

const screenshotCards = [
  {
    label: "Chats",
    title: "Live presence, unread counts, and rich message previews",
    messages: [
      { side: "left", text: "Open the website and download the APK." },
      { side: "right", text: "Done. The app is installing now." },
      { side: "left", text: "Perfect. Log in and start chatting." },
    ],
  },
  {
    label: "Updates",
    title: "Status feed with text, photo, and view tracking",
    statusLines: ["My status", "Photo update", "Seen by 12 contacts"],
  },
  {
    label: "Calls",
    title: "Answer, speaker, mute, and session state all in one flow",
    callLines: ["Video call", "Connected", "00:08:14"],
  },
];

const installSteps = [
  {
    title: "Open this site on an Android phone",
    copy: "Share the website URL with users so they can open it in Chrome or any mobile browser.",
  },
  {
    title: "Tap the VideoApp download button",
    copy: "The button points to your latest APK through the backend tracker or a direct APK URL.",
  },
  {
    title: "Install the APK and start using the app",
    copy: "After the file finishes downloading, the user opens it and completes the Android install flow.",
  },
];

const homeHighlights = [
  "Android APK in one tap",
  "Shareable website link",
  "Live version and release notes",
];

const supportItems = [
  {
    title: "Direct APK mode",
    copy:
      "If you already host the APK somewhere, set `VITE_DIRECT_DOWNLOAD_URL` on the website and the button will download the app without waiting for backend metadata.",
  },
  {
    title: "Tracked backend mode",
    copy:
      "If your backend is live, the website reads `/downloads/latest` and sends visitors through `/downloads/latest.apk` so you can track downloads and update releases centrally.",
  },
  {
    title: "Production rollout",
    copy:
      "Publish a fresh APK URL through the release endpoint, and both the website and the mobile app update flow can pick up the newest Android build.",
  },
];

const deploymentSteps = [
  "Deploy the `website/` app to GitHub Pages, Netlify, Vercel, or any static host.",
  "Set `VITE_API_BASE_URL` to your live backend, or set `VITE_DIRECT_DOWNLOAD_URL` to a direct APK file URL.",
  "On the backend, set `APK_DOWNLOAD_URL` so `/downloads/latest.apk` redirects users to your current Android build.",
  "Share the website URL with users so they can open the page and tap Download VideoApp APK on mobile.",
];

const resolveApiBaseUrl = () => {
  const configuredUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:5000";
  }

  return "";
};

const resolveDirectDownloadUrl = () =>
  String(import.meta.env.VITE_DIRECT_DOWNLOAD_URL || "").trim();

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

const formatDownloads = (value) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
};

const usePageMeta = (title, description) => {
  useEffect(() => {
    document.title = `${title} | VideoApp`;

    const metaDescription = document.querySelector('meta[name="description"]');

    if (metaDescription) {
      metaDescription.setAttribute("content", description);
    }
  }, [description, title]);
};

const useLatestRelease = () => {
  const [release, setRelease] = useState(defaultRelease);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const apiBaseUrl = resolveApiBaseUrl();
  const directDownloadUrl = resolveDirectDownloadUrl();

  useEffect(() => {
    let isMounted = true;

    const loadRelease = async () => {
      if (!apiBaseUrl) {
        setStatus(directDownloadUrl ? "direct" : "idle");
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/downloads/latest`);

        if (!response.ok) {
          throw new Error("Unable to load the live Android release metadata.");
        }

        const payload = await response.json();

        if (isMounted && payload.release) {
          setRelease(payload.release);
          setStatus("ready");
          setError("");
        }
      } catch (loadError) {
        if (isMounted) {
          setStatus(directDownloadUrl ? "direct" : "error");
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the live Android release metadata."
          );
        }
      }
    };

    void loadRelease();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, directDownloadUrl]);

  const downloadHref =
    release.downloadUrl || directDownloadUrl || (apiBaseUrl ? `${apiBaseUrl}/downloads/latest.apk` : "");
  const isDownloadReady = Boolean(downloadHref);
  const downloadMode =
    status === "ready"
      ? "Live backend release"
      : directDownloadUrl
        ? "Direct APK link"
        : apiBaseUrl
          ? "Backend download endpoint"
          : "Setup required";

  return { apiBaseUrl, downloadHref, downloadMode, error, isDownloadReady, release, status };
};

const BrandMark = () => (
  <div className="brand-mark" aria-hidden="true">
    <span className="brand-mark__halo" />
    <span className="brand-mark__inner">VA</span>
  </div>
);

const SectionIntro = ({ eyebrow, title, copy, align = "left" }) => (
  <div className={`section-intro section-intro--${align}`}>
    <span className="eyebrow">{eyebrow}</span>
    <h1 className="section-title">{title}</h1>
    <p className="section-copy">{copy}</p>
  </div>
);

const DownloadButton = ({ block = false, downloadHref, isDownloadReady, label }) => {
  const className = `button button--primary${block ? " button--block" : ""}`;

  if (isDownloadReady) {
    return (
      <a className={className} href={downloadHref}>
        {label}
      </a>
    );
  }

  return (
    <NavLink className={className} to="/support">
      Configure APK Link
    </NavLink>
  );
};

const Shell = ({ children }) => (
  <div className="site-shell">
    <header className="site-header">
      <NavLink className="brand-link" to="/">
        <BrandMark />
        <div>
          <strong>VideoApp</strong>
          <span>Website to Android app download flow</span>
        </div>
      </NavLink>

      <nav className="site-nav" aria-label="Primary navigation">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/features">Features</NavLink>
        <NavLink to="/screenshots">Screenshots</NavLink>
        <NavLink to="/download">Download</NavLink>
        <NavLink to="/support">Setup</NavLink>
      </nav>
    </header>

    <main>{children}</main>

    <footer className="site-footer">
      <div>
        <strong>Built to share your APK</strong>
        <p>
          React website, Node.js backend, MongoDB data, Socket.io delivery, and Expo Android app
          in one repo.
        </p>
      </div>
      <div className="footer-badges">
        <span>GitHub Pages</span>
        <span>Netlify</span>
        <span>Vercel</span>
        <span>Render</span>
        <span>Railway</span>
        <span>Android APK</span>
      </div>
    </footer>
  </div>
);

const HomePage = ({ downloadHref, downloadMode, isDownloadReady, release, status }) => {
  usePageMeta(
    "Home",
    "VideoApp gives users a simple website with a download button that starts the Android APK install flow on mobile."
  );

  const statusCopy = isDownloadReady
    ? "Users can visit this website and tap one button to start downloading the VideoApp APK."
    : "Add your APK link and this page becomes a public download landing page for the app.";

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Android app download website</span>
          <h1 className="hero-title">Open the site, tap the link, and download VideoApp.</h1>
          <p className="hero-body">
            This website is built for one clear job: users visit the page, see your VideoApp
            details, and tap a button that downloads the Android application on their phone.
          </p>
          <div className="status-row">
            <span
              className={`availability-pill ${
                isDownloadReady ? "availability-pill--ready" : "availability-pill--pending"
              }`}
            >
              {downloadMode}
            </span>
            <span className="status-note">{statusCopy}</span>
          </div>
          <div className="hero-actions">
            <DownloadButton
              downloadHref={downloadHref}
              isDownloadReady={isDownloadReady}
              label="Download VideoApp APK"
            />
            <NavLink className="button button--secondary" to="/download">
              How to Install
            </NavLink>
          </div>
          <div className="hero-badges">
            {homeHighlights.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="hero-meta">
            <div>
              <span className="meta-label">Latest version</span>
              <strong>{release.version}</strong>
            </div>
            <div>
              <span className="meta-label">Build number</span>
              <strong>{release.buildNumber}</strong>
            </div>
            <div>
              <span className="meta-label">Download source</span>
              <strong>{status === "ready" ? "Tracked release" : downloadMode}</strong>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-orb visual-orb--large" />
          <div className="visual-orb visual-orb--small" />
          <div className="hero-device hero-device--main">
            <div className="device-topbar">
              <span />
              <strong>VideoApp Download</strong>
              <span className="presence-dot" />
            </div>
            <div className="device-story">
              <div>
                <span className="story-chip">Simple mobile flow</span>
                <h2>From website visitor to installed app in three steps</h2>
                <p>
                  Users do not need to search for your app. They just open the page and press the
                  APK button.
                </p>
              </div>
              <div className="install-checklist">
                {installSteps.map((step, index) => (
                  <div key={step.title} className="install-checklist__item">
                    <strong>
                      {index + 1}. {step.title}
                    </strong>
                    <span>{step.copy}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="hero-device hero-device--floating">
            <div className="mini-card">
              <span className="eyebrow">APK status</span>
              <strong>{isDownloadReady ? "Ready to share" : "Needs setup"}</strong>
            </div>
            <div className="mini-card">
              <span className="eyebrow">Current release</span>
              <strong>Version {release.version}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="summary-grid">
        {installSteps.map((step, index) => (
          <article key={step.title}>
            <span className="summary-kicker">Step {index + 1}</span>
            <h2>{step.title}</h2>
            <p>{step.copy}</p>
          </article>
        ))}
      </section>

      <section className="feature-highlight">
        <SectionIntro
          eyebrow="Why this website works"
          title="Your public page, Android APK link, and release system all stay connected."
          copy="The website can show the current version, the backend can track downloads, and users get a single shareable link that leads straight to the VideoApp install flow."
        />
      </section>
    </div>
  );
};

const FeaturesPage = () => {
  usePageMeta(
    "Features",
    "Explore VideoApp features including chat, voice and video calls, status, private contact sync, and website-based Android APK delivery."
  );

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="Feature system"
        title="Everything users expect from a modern messaging app plus a simple download website"
        copy="The site explains the product clearly, while the app and backend carry the real behavior: chat, calls, status, contact matching, and APK delivery."
      />

      <section className="feature-grid">
        {featureCards.map((card) => (
          <article key={card.title} className="feature-card">
            <span className="eyebrow">{card.eyebrow}</span>
            <h2>{card.title}</h2>
            <p>{card.copy}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

const ScreenshotsPage = () => {
  usePageMeta(
    "Screenshots",
    "Preview VideoApp mobile screenshots for chats, updates, calls, and the Android app experience users download from the website."
  );

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="Preview gallery"
        title="A mobile-first interface designed to feel familiar, smooth, and ready to install"
        copy="These live mockups mirror the product language used inside the Android app: green surfaces, rich cards, bold hierarchy, and activity-driven states."
        align="center"
      />

      <section className="screenshot-grid">
        {screenshotCards.map((card) => (
          <article key={card.label} className="phone-frame">
            <div className="phone-frame__screen">
              <div className="phone-frame__header">
                <span className="eyebrow">{card.label}</span>
                <strong>{card.title}</strong>
              </div>

              {card.messages ? (
                <div className="chat-preview">
                  {card.messages.map((message) => (
                    <div
                      key={`${card.label}-${message.text}`}
                      className={`chat-preview__bubble chat-preview__bubble--${message.side}`}
                    >
                      {message.text}
                    </div>
                  ))}
                </div>
              ) : null}

              {card.statusLines ? (
                <div className="stack-preview">
                  {card.statusLines.map((line) => (
                    <div key={line} className="stack-preview__line">
                      {line}
                    </div>
                  ))}
                </div>
              ) : null}

              {card.callLines ? (
                <div className="call-preview">
                  {card.callLines.map((line) => (
                    <div key={line} className="call-preview__line">
                      {line}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

const DownloadPage = ({
  downloadHref,
  downloadMode,
  error,
  isDownloadReady,
  release,
  status,
}) => {
  usePageMeta(
    "Download",
    "Download the latest VideoApp Android APK from a simple website landing page and review the install steps and release notes."
  );

  const helpText =
    status === "ready"
      ? "This button uses the backend tracker so every click can point to the latest published VideoApp APK."
      : isDownloadReady
        ? "This page is using a direct APK URL, so users can still download the app even without live backend release metadata."
        : "Set `VITE_API_BASE_URL`, `VITE_DIRECT_DOWNLOAD_URL`, or `APK_DOWNLOAD_URL` to activate the real download button.";

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="Android release"
        title="A download page users can open on mobile and install from immediately"
        copy="This page presents the latest VideoApp APK, installation guidance, and release notes so visitors can understand what they are downloading before they tap."
      />

      <section className="download-layout">
        <article className="download-card">
          <span className="eyebrow">Latest APK</span>
          <h2>Version {release.version}</h2>
          <p className="download-meta">
            Build {release.buildNumber} - Published {formatDate(release.publishedAt)}
          </p>
          <div className="download-stats">
            <div>
              <span className="meta-label">Tracked downloads</span>
              <strong>{formatDownloads(release.downloadCount)}</strong>
            </div>
            <div>
              <span className="meta-label">Minimum supported build</span>
              <strong>{release.minimumSupportedBuildNumber || release.buildNumber}</strong>
            </div>
          </div>
          <DownloadButton
            block
            downloadHref={downloadHref}
            isDownloadReady={isDownloadReady}
            label="Download VideoApp APK"
          />
          <p className="download-help">{helpText}</p>
          <p className="download-help">Current link mode: {downloadMode}.</p>
          {error ? <p className="helper helper--warning">{error}</p> : null}
        </article>

        <article className="release-notes-card">
          <span className="eyebrow">Release notes</span>
          <ul className="notes-list">
            {(release.releaseNotes?.length ? release.releaseNotes : defaultRelease.releaseNotes).map(
              (note) => (
                <li key={note}>{note}</li>
              )
            )}
          </ul>
        </article>
      </section>

      <section className="summary-grid">
        {installSteps.map((step, index) => (
          <article key={step.title}>
            <span className="summary-kicker">Install step {index + 1}</span>
            <h2>{step.title}</h2>
            <p>{step.copy}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

const SupportPage = () => {
  usePageMeta(
    "Setup",
    "Setup guidance for VideoApp including website hosting, backend rollout, direct APK links, and tracked Android release delivery."
  );

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="Setup and deployment"
        title="Everything you need to put the website online and let users download the app"
        copy="The repo is structured so the public site can deploy separately from the API while still pulling live release information from the server or a direct APK URL."
      />

      <section className="support-grid">
        {supportItems.map((item) => (
          <article key={item.title} className="support-card">
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>

      <section className="deployment-card">
        <span className="eyebrow">Deployment checklist</span>
        <ol className="deployment-list">
          {deploymentSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
};

const AppRoutes = () => {
  const releaseState = useLatestRelease();

  return (
    <>
      <ScrollToTop />
      <Shell>
        <Routes>
          <Route path="/" element={<HomePage {...releaseState} />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/screenshots" element={<ScreenshotsPage />} />
          <Route path="/download" element={<DownloadPage {...releaseState} />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </>
  );
};

export default function App() {
  return <AppRoutes />;
}
