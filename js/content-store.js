(function () {
  const STORAGE_KEY = "utopiax_cms_override";

  function getByPath(obj, path) {
    return path.split(".").reduce((o, key) => (o != null ? o[key] : undefined), obj);
  }

  function setByPath(obj, path, value) {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (cur[keys[i]] == null) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  function deepMerge(target, source) {
    if (!source) return target;
    Object.keys(source).forEach(function (key) {
      var sv = source[key];
      var tv = target[key];
      if (sv && typeof sv === "object" && !Array.isArray(sv)) {
        if (!tv || typeof tv !== "object") target[key] = {};
        deepMerge(target[key], sv);
      } else {
        target[key] = sv;
      }
    });
    return target;
  }

  function readOverride() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_e) {
      return null;
    }
  }

  function validMediaList(arr) {
    return (arr || []).filter(function (m) {
      return m && String(m.title || "").trim();
    });
  }

  /** CMS saves once stored empty media rows — prefer file defaults when override has no titles */
  function repairMediaItems(base, content) {
    var fromContent = validMediaList(content.mediaItems);
    var fromBase = validMediaList(base.mediaItems);

    if (fromContent.length) {
      content.mediaItems = fromContent;
      return;
    }

    content.mediaItems = fromBase;

    var override = readOverride();
    if (override && override.mediaItems && fromBase.length) {
      override.mediaItems = fromBase;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(override));
      } catch (_e) {
        /* ignore quota */
      }
    }
  }

  function applyOverride(base) {
    var override = readOverride();
    var merged = JSON.parse(JSON.stringify(base));
    if (override) deepMerge(merged, override);
    repairMediaItems(base, merged);
    return merged;
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  }

  async function loadContent() {
    var base = null;
    var urls = ["./content.json", "content.json", "/content.json"];

    for (var i = 0; i < urls.length; i++) {
      try {
        base = await fetchJson(urls[i]);
        if (base) break;
      } catch (_e) {
        /* try next */
      }
    }

    if (!base) {
      try {
        base = await fetchJson("/api/content");
      } catch (_e2) {
        /* server not running */
      }
    }

    if (!base) {
      throw new Error("Could not load content.json");
    }

    window.CONTENT = applyOverride(base);
    return window.CONTENT;
  }

  function applyCmsBindings() {
    if (!window.CONTENT) return;
    document.querySelectorAll("[data-cms]").forEach(function (el) {
      var val = getByPath(window.CONTENT, el.dataset.cms);
      if (val == null) return;
      if (el.dataset.cmsHrefPath) {
        var href = getByPath(window.CONTENT, el.dataset.cmsHrefPath);
        if (href) {
          if (el.dataset.cmsMailto === "true") el.href = "mailto:" + href;
          else if (el.dataset.cmsTel === "true") el.href = "tel:" + href;
          else el.href = href;
        }
      } else if (el.dataset.cmsHtml === "true") {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });
  }

  function showReveals() {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  function showBanner(message) {
    if (document.querySelector(".content-error-banner")) return;
    var banner = document.createElement("d" + "iv");
    banner.className = "content-error-banner";
    banner.textContent = message;
    document.body.prepend(banner);
  }

  window.ContentStore = {
    STORAGE_KEY: STORAGE_KEY,
    load: loadContent,
    get: function (path) {
      return getByPath(window.CONTENT, path);
    },
    applyCmsBindings: applyCmsBindings,
    getByPath: getByPath,
    setByPath: setByPath,
    applyOverride: applyOverride,
    readOverride: readOverride,
  };

  document.addEventListener("DOMContentLoaded", async function () {
    try {
      await loadContent();
      applyCmsBindings();
    } catch (e) {
      console.error(e);
      showBanner(
        "Content file missing or blocked. Ensure content.json is in the project folder, or run: npm start — then open http://localhost:3000",
      );
    } finally {
      showReveals();
      document.dispatchEvent(new CustomEvent("contentready"));
    }
  });
})();
