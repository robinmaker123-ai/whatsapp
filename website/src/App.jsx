import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

const defaultRelease = {
  version: "1.0.0",
  buildNumber: 1,
  releaseNotes: [
    "OTP sign in with private contact matching",
    "Real-time chat, status, and call signaling",
    "APK delivery with server-side download tracking",
  ],
  downloadCount: 0,
  publishedAt: "",
};

const featureCards = [
  {
    eyebrow: "Chat",
    title: "WhatsApp-style one-to-one messaging",
    copy:
      "Delivered and seen states, typing signals, media uploads, reply threads, and live presence all come from the real backend.",
  },
  {
    eyebrow: "Calls",
    title: "Voice and video call flow",
    copy:
      "Call history, ringing state, answer controls, and signaling are wired through Socket.io so the app feels production-first from the first tap.",
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
    eyebrow: "Delivery",
    title: "APK releases built for rollout",
    copy:
      "The site reads the latest Android release metadata, shows release notes, tracks download counts, and gives the app a live update-check endpoint.",
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
      { side: "left", text: "Hey, are you free for a video call?" },
      { side: "right", text: "Yes. I am opening the app now." },
      { side: "left", text: "Perfect. I already synced my contacts." },
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

const supportItems = [
  {
    title: "Deployment support",
    copy:
      "Use the repo docs to deploy the static site on GitHub Pages, Netlify, or Vercel, then point the Android app and site to your live backend.",
  },
  {
    title: "Release operations",
    copy:
      "Publish a new APK URL through the backend release endpoint and the website plus in-app update checker immediately surface the latest version.",
  },
  {
    title: "Backend readiness",
    copy:
      "MongoDB, JWT auth, Socket.io messaging, media uploads, status lifecycle, and download tracking live in the same server codebase.",
  },
];

const deploymentSteps = [
  "Deploy the `website/` app to GitHub Pages, Netlify, Vercel, or any static host.",
  "Deploy the Node.js API and Socket.io server to Render, Railway, or your own VPS.",
  "Set `VITE_API_BASE_URL` in the website host so download metadata points at your live server.",
  "Publish your APK URL through the release endpoint and ship Android builds with EAS.",
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
  } catch (error) {
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

  useEffect(() => {
    let isMounted = true;

    const loadRelease = async () => {
      if (!apiBaseUrl) {
        setStatus("idle");
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
          setStatus("error");
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
  }, [apiBaseUrl]);

  const downloadHref =
    release.downloadUrl || (apiBaseUrl ? `${apiBaseUrl}/downloads/latest.apk` : "#/download");

  return { apiBaseUrl, downloadHref, error, release, status };
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

const Shell = ({ children }) => (
  <div className="site-shell">
    <header className="site-header">
      <NavLink className="brand-link" to="/">
        <BrandMark />
        <div>
          <strong>VideoApp</strong>
          <span>Private messaging for everyone</span>
        </div>
      </NavLink>

      <nav className="site-nav" aria-label="Primary navigation">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/features">Features</NavLink>
        <NavLink to="/screenshots">Screenshots</NavLink>
        <NavLink to="/download">Download</NavLink>
        <NavLink to="/support">Support</NavLink>
      </nav>
    </header>

    <main>{children}</main>

    <footer className="site-footer">
      <div>
        <strong>Built for launch</strong>
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
        <span>VPS</span>
      </div>
    </footer>
  </div>
);

const HomePage = ({ downloadHref, release, status }) => {
  usePageMeta(
    "Home",
    "VideoApp is a deployable WhatsApp-style ecosystem with a premium website, Android APK delivery, and a real-time Node.js chat backend."
  );

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Android chat ecosystem</span>
          <h1 className="hero-title">Private messaging for everyone</h1>
          <p className="hero-body">
            Launch a WhatsApp-style experience with a premium public website, OTP login, contact
            sync, real-time chat, status, release tracking, and server deployment readiness.
          </p>
          <div className="hero-actions">
            <a className="button button--primary" href={downloadHref}>
              Download Android App
            </a>
            <NavLink className="button button--secondary" to="/download">
              Login Guide
            </NavLink>
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
              <span className="meta-label">Release status</span>
              <strong>{status === "ready" ? "Live metadata" : "Static fallback"}</strong>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-orb visual-orb--large" />
          <div className="visual-orb visual-orb--small" />
          <div className="hero-device hero-device--main">
            <div className="device-topbar">
              <span />
              <strong>VideoApp</strong>
              <span className="presence-dot" />
            </div>
            <div className="device-story">
              <div>
                <span className="story-chip">End-to-end ready</span>
                <h2>Chats, status, and release delivery in one flow</h2>
              </div>
              <div className="mini-list">
                <div>
                  <strong>Contact sync</strong>
                  <span>Hashes contacts locally before matching</span>
                </div>
                <div>
                  <strong>APK delivery</strong>
                  <span>Server-side versioning and download counts</span>
                </div>
                <div>
                  <strong>Live backend</strong>
                  <span>Socket.io messaging, presence, and call signaling</span>
                </div>
              </div>
            </div>
          </div>
          <div className="hero-device hero-device--floating">
            <div className="mini-card">
              <span className="eyebrow">Matched contacts</span>
              <strong>Show only people already using the app</strong>
            </div>
            <div className="mini-card">
              <span className="eyebrow">Invite flow</span>
              <strong>Everyone else gets a share-ready invite link</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="summary-grid">
        <article>
          <span className="summary-kicker">Public website</span>
          <h2>Premium responsive landing pages</h2>
          <p>Feature storytelling, screenshots, release notes, support, and a real APK CTA.</p>
        </article>
        <article>
          <span className="summary-kicker">Android app</span>
          <h2>Expo-based mobile experience</h2>
          <p>OTP sign in, contact sync, chat UI, calls, status, media sharing, and presence.</p>
        </article>
        <article>
          <span className="summary-kicker">Backend</span>
          <h2>Node.js, Express, MongoDB, Socket.io</h2>
          <p>JWT auth, message persistence, status lifecycle, call records, and download tracking.</p>
        </article>
      </section>

      <section className="feature-highlight">
        <SectionIntro
          eyebrow="Why it feels launch-ready"
          title="Everything from the marketing website to the Android download flow shares the same live release system."
          copy="The public site reads live server metadata, the backend tracks downloads, and the app can check the same endpoint to surface fresh builds."
        />
      </section>
    </div>
  );
};

const FeaturesPage = () => {
  usePageMeta(
    "Features",
    "Explore VideoApp features including chat, voice and video calls, status, file sharing, contact sync, and live Android release delivery."
  );

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="Feature system"
        title="Everything users expect from a modern WhatsApp-style product"
        copy="The website presents the product clearly while the app and backend carry the real behavior: no fake chats, no demo-only flows, and no disconnected marketing copy."
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
    "Preview VideoApp mobile screenshots for chats, updates, calls, and the WhatsApp-style green Android experience."
  );

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="Preview gallery"
        title="A mobile-first interface designed to feel familiar, smooth, and production-ready"
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

const DownloadPage = ({ downloadHref, error, release, status }) => {
  usePageMeta(
    "Download",
    "Download the latest VideoApp Android APK, review the release notes, and deploy the ecosystem with a live backend."
  );

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="Android release"
        title="One page for the latest APK, version, release notes, and rollout details"
        copy="The website can read the newest live release from the backend. If your backend is not configured yet, the page still presents the release structure with a deployment-safe fallback."
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
          <a className="button button--primary button--block" href={downloadHref}>
            Download APK
          </a>
          <p className="download-help">
            {status === "ready"
              ? "This link uses the backend tracker so every click updates the live download count."
              : "Set `VITE_API_BASE_URL` on the website deployment to switch this page to live release metadata."}
          </p>
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
    </div>
  );
};

const SupportPage = () => {
  usePageMeta(
    "Support",
    "Support and deployment guidance for VideoApp including site hosting, backend rollout, APK publishing, and release operations."
  );

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="Support and deployment"
        title="Everything you need to ship the website, backend, and Android release together"
        copy="The repo is structured so the public site can deploy separately from the API while still pulling live release information from the server."
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
