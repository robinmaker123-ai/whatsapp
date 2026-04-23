const fs = require("fs");

const config = require("../config/env");

const defaultProduct = {
  app: {
    name: "VideoApp",
    shortName: "VA",
    tagline: "Private messaging, calls, and communities in one place.",
    description:
      "VideoApp is a WhatsApp-style communication platform with website, mobile, backend, and shared release management in one repository.",
  },
  hero: {
    eyebrow: "Modern communication",
    headline: "Secure chat, calls, and communities.",
    body: "A premium full-stack communication experience.",
    downloadLabel: "Download Android App",
    webLabel: "Open Web Login",
  },
  features: [],
  screenshots: [],
  testimonials: [],
  faq: [],
  updates: [],
  seo: {
    title: "VideoApp",
    description:
      "VideoApp is a WhatsApp-style communication platform with website, mobile, backend, and shared release management in one repository.",
    keywords: [],
  },
  footer: {
    contactEmail: "hello@videoapp.local",
    privacyUrl: "#privacy",
    termsUrl: "#terms",
    socialLinks: [],
  },
};

const loadProductConfig = () => {
  try {
    if (!fs.existsSync(config.sharedProductConfigPath)) {
      return defaultProduct;
    }

    const payload = JSON.parse(fs.readFileSync(config.sharedProductConfigPath, "utf8"));
    return {
      ...defaultProduct,
      ...payload,
      app: {
        ...defaultProduct.app,
        ...(payload.app || {}),
      },
      hero: {
        ...defaultProduct.hero,
        ...(payload.hero || {}),
      },
      seo: {
        ...defaultProduct.seo,
        ...(payload.seo || {}),
      },
      footer: {
        ...defaultProduct.footer,
        ...(payload.footer || {}),
      },
    };
  } catch (error) {
    return defaultProduct;
  }
};

module.exports = {
  loadProductConfig,
};
