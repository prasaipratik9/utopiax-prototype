/**
 * Universal site header & footer — loaded on all public pages (not CMS admin).
 */
(function () {
  const DEFAULT_NAV = [
    { href: "openmindx.html", label: "OpenMindX" },
    { href: "ideationworx.html", label: "IdeationWorX" },
    { href: "lumierex.html", label: "LumiereX" },
    { href: "xperiences.html", label: "Xperiences" },
    { href: "media.html", label: "Media" },
    { href: "about.html", label: "About" },
    { href: "contact.html", label: "Contact" },
  ];

  const DEFAULT_SITE = {
    footerTagline: "Making the impossible possible.",
    footerLocation: "Created in NSW, Australia",
    phone: "(+61) 425 236 156",
    phoneHref: "+61425236156",
    email: "info@utopiax.global",
    newsletterTitle: "Xperience Seekers",
    newsletterDesc: "For the latest programs, events, workshops and news.",
  };

  const DEFAULT_SOCIAL = [
    { href: "https://www.linkedin.com/in/christinagerakiteys/", label: "LinkedIn" },
    { href: "https://www.instagram.com/christina_gerakiteys/", label: "Instagram" },
    { href: "https://www.facebook.com/utopiaxglobal", label: "Facebook" },
    { href: "https://twitter.com/utopiaxglobal", label: "Twitter" },
    { href: "https://www.youtube.com/user/ideationatwork", label: "YouTube" },
    { href: "https://vimeo.com/utopiax", label: "Vimeo" },
  ];

  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getPageId() {
    return document.body.dataset.page || "";
  }

  function isPublicSite() {
    return document.body.hasAttribute("data-public-site");
  }

  function getNav() {
    const nav = window.CONTENT?.nav;
    return nav?.length ? nav : DEFAULT_NAV;
  }

  function getSite() {
    return { ...DEFAULT_SITE, ...(window.CONTENT?.site || {}) };
  }

  function getSocial() {
    const social = window.CONTENT?.social;
    return social?.length ? social : DEFAULT_SOCIAL;
  }

  function buildHeaderHtml() {
    const page = getPageId();
    const nav = getNav();
    const links = nav
      .map((item) => {
        const slug = item.href.replace(".html", "");
        const active = page === slug ? " is-active" : "";
        return `<a href="${esc(item.href)}" class="nav-link${active}">${esc(item.label)}</a>`;
      })
      .join("");

    return `
      <header class="site-header">
        <div class="header-inner">
          <a href="index.html" class="logo" aria-label="UtopiaX home">
            <span class="logo-mark">U</span>
            <span class="logo-text">Utopia<span class="logo-accent">X</span></span>
          </a>
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
            <span class="nav-toggle-bar"></span>
            <span class="nav-toggle-bar"></span>
            <span class="nav-toggle-bar"></span>
          </button>
          <nav id="site-nav" class="site-nav" aria-label="Main navigation">${links}</nav>
        </div>
      </header>`;
  }

  function buildFooterHtml() {
    const site = getSite();
    const social = getSocial();
    const socialHtml = social
      .map(
        (s) =>
          `<a href="${esc(s.href)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>`
      )
      .join("");

    return `
      <footer class="site-footer">
        <div class="footer-inner">
          <div class="footer-col footer-brand">
            <p class="footer-tagline">${esc(site.footerTagline)}</p>
            <p class="footer-location">${esc(site.footerLocation)}</p>
          </div>
          <div class="footer-col footer-newsletter">
            <h3 class="footer-col__title">${esc(site.newsletterTitle)}</h3>
            <p class="footer-col__text">${esc(site.newsletterDesc)}</p>
            <form class="newsletter-form" id="newsletter-form" novalidate>
              <input type="email" name="email" placeholder="Your email" required aria-label="Email for newsletter" />
              <button type="submit" class="btn btn-primary btn-sm">Join</button>
            </form>
            <p class="form-message" id="newsletter-message" hidden></p>
          </div>
          <div class="footer-col footer-connect">
            <h3 class="footer-col__title">Connect</h3>
            <nav class="footer-social" aria-label="Social media">${socialHtml}</nav>
          </div>
          <div class="footer-col footer-contact">
            <h3 class="footer-col__title">Contact</h3>
            <div class="footer-contact-links">
              <a href="tel:${esc(site.phoneHref)}">${esc(site.phone)}</a>
              <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span class="footer-bottom__item footer-bottom__copy">&copy; UtopiaX ${new Date().getFullYear()}</span>
          <a href="#" class="footer-bottom__item footer-bottom__privacy">Privacy Policy</a>
          <a href="admin/" class="footer-bottom__item footer-bottom__admin">Admin</a>
        </div>
      </footer>`;
  }

  function fixTags(html) {
    return html.split("motion").join("div");
  }

  function bindHeaderEvents(headerRoot) {
    const toggle = headerRoot.querySelector(".nav-toggle");
    const navEl = headerRoot.querySelector(".site-nav");
    if (!toggle || !navEl) return;

    toggle.addEventListener("click", () => {
      const open = navEl.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("nav-open", open);
    });

    navEl.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        navEl.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("nav-open");
      });
    });
  }

  function bindNewsletterForm() {
    const form = document.getElementById("newsletter-form");
    const msg = document.getElementById("newsletter-message");
    if (!form || form.dataset.bound === "true") return;
    form.dataset.bound = "true";

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.textContent = "Please enter a valid email address.";
        msg.hidden = false;
        msg.className = "form-message is-error";
        return;
      }
      msg.textContent = "Thanks! You're on the list.";
      msg.hidden = false;
      msg.className = "form-message is-success";
      form.reset();
    });
  }

  function renderHeader() {
    const el = document.getElementById("site-header");
    if (!el) return;
    el.innerHTML = fixTags(buildHeaderHtml());
    bindHeaderEvents(el);
  }

  function renderFooter() {
    const el = document.getElementById("site-footer");
    if (!el) return;
    el.innerHTML = fixTags(buildFooterHtml());
    bindNewsletterForm();
  }

  function render() {
    if (!isPublicSite()) return;
    renderHeader();
    renderFooter();
  }

  window.UtopiaLayout = {
    render,
    renderHeader,
    renderFooter,
    getNav,
    getSite,
    getSocial,
    DEFAULT_NAV,
    DEFAULT_SITE,
  };

  if (isPublicSite()) {
    document.addEventListener("DOMContentLoaded", render);
    document.addEventListener("contentready", render);
  }
})();
