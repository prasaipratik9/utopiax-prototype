(function () {
  const PAGE = document.body.dataset.page || "";
  const PER_PAGE = 6;

  function c(path) {
    return window.ContentStore?.get(path);
  }

  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initPagination(containerId, items, renderCard) {
    const container = document.getElementById(containerId);
    const pagination = document.getElementById(containerId + "-pagination");
    if (!container || !pagination || !items?.length) return;

    let page = 1;
    const totalPages = Math.ceil(items.length / PER_PAGE);

    function render() {
      const start = (page - 1) * PER_PAGE;
      container.innerHTML = items.slice(start, start + PER_PAGE).map(renderCard).join("");
      pagination.innerHTML = "";
      if (totalPages <= 1) return;

      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "btn btn-secondary btn-sm";
      prev.textContent = "Previous";
      prev.disabled = page === 1;
      prev.addEventListener("click", () => {
        page--;
        render();
        container.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      const info = document.createElement("span");
      info.className = "pagination-info";
      info.textContent = `Page ${page} of ${totalPages}`;

      const next = document.createElement("button");
      next.type = "button";
      next.className = "btn btn-secondary btn-sm";
      next.textContent = "Next";
      next.disabled = page === totalPages;
      next.addEventListener("click", () => {
        page++;
        render();
        container.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      pagination.append(prev, info, next);
    }
    render();
  }

  const MEDIA_THUMBS = {
    article:
      "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
    video:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    audio:
      "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80",
  };

  const MEDIA_TYPE_LABEL = {
    article: "Article",
    video: "Video",
    audio: "Audio",
  };

  function validMediaItems(list) {
    return (list || []).filter((m) => m && (m.title || "").trim());
  }

  function mediaThumb(type) {
    return MEDIA_THUMBS[type] || MEDIA_THUMBS.article;
  }

  function mediaTypeLabel(type) {
    return MEDIA_TYPE_LABEL[type] || "Media";
  }

  function renderMediaCard(m, opts) {
    const large = opts && opts.large;
    const type = m.type || "article";
    const cta =
      type === "video" ? "Watch" : type === "audio" ? "Listen" : "Read article";
    return `
      <article class="media-card${large ? " media-card--featured" : ""}" data-type="${esc(type)}">
        <a href="#" class="media-card__visual" onclick="return false;" aria-label="${esc(cta)}: ${esc(m.title)}">
          <img src="${mediaThumb(type)}" alt="" loading="lazy" width="640" height="360" />
          <span class="media-card__type media-card__type--${esc(type)}">${esc(mediaTypeLabel(type))}</span>
          ${type === "video" ? '<span class="media-card__play" aria-hidden="true">▶</span>' : ""}
          ${type === "audio" ? '<span class="media-card__wave" aria-hidden="true"></span>' : ""}
        </a>
        <div class="media-card__body">
          <span class="media-card__meta">${esc(m.date)} · ${esc(m.category)}</span>
          <h3>${esc(m.title)}</h3>
          <p>${esc(m.excerpt)}</p>
          <a href="#" class="media-card__link" onclick="return false;">${esc(cta)} →</a>
        </div>
      </article>`;
  }

  function renderMediaCards(items) {
    return validMediaItems(items).map((m) => renderMediaCard(m)).join("");
  }

  function renderMediaSpotlight(items) {
    const list = validMediaItems(items);
    const el = document.getElementById("media-spotlight");
    if (!el || !list.length) return;

    const [lead, ...rest] = list;
    const side = rest.slice(0, 2);
    el.innerHTML =
      renderMediaCard(lead, { large: true }) +
      `<div class="media-spotlight-side">${side.map((m) => renderMediaCard(m)).join("")}</div>`;
  }

  function renderMediaStats(items) {
    const list = validMediaItems(items);
    const el = document.getElementById("media-stats");
    if (!el) return;
    const counts = { article: 0, video: 0, audio: 0 };
    list.forEach((m) => {
      if (counts[m.type] != null) counts[m.type] += 1;
    });
    el.innerHTML = `
      <div class="media-stat"><strong>${list.length}</strong><span>Stories</span></div>
      <div class="media-stat"><strong>${counts.article}</strong><span>Articles</span></div>
      <div class="media-stat"><strong>${counts.video}</strong><span>Video</span></div>
      <div class="media-stat"><strong>${counts.audio}</strong><span>Audio</span></div>`;
  }

  function updateMediaCount(n, filter) {
    const el = document.getElementById("media-count");
    if (!el) return;
    const label =
      filter === "all"
        ? "all formats"
        : filter === "article"
          ? "articles"
          : filter === "video"
            ? "video"
            : "audio";
    el.textContent = n ? `Showing ${n} ${n === 1 ? "item" : "items"} · ${label}` : "";
  }

  function initMediaFilters() {
    const grid = document.getElementById("media-grid");
    const filters = document.querySelectorAll("[data-media-filter]");
    const empty = document.getElementById("media-empty");
    const items = validMediaItems(window.CONTENT?.mediaItems);
    if (!grid || !filters.length) return;

    renderMediaStats(items);
    renderMediaSpotlight(items);

    function showList(filtered, filterKey) {
      grid.innerHTML = renderMediaCards(filtered);
      updateMediaCount(filtered.length, filterKey);
      if (empty) {
        empty.hidden = filtered.length > 0;
        grid.hidden = filtered.length === 0;
      }
    }

    showList(items, "all");

    filters.forEach((btn) => {
      btn.addEventListener("click", () => {
        filters.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const filter = btn.dataset.mediaFilter;
        const filtered =
          filter === "all" ? items : items.filter((m) => m.type === filter);
        showList(filtered, filter);
      });
    });
  }

  function renderOpenMindX() {
    const keynotes = c("openmindx.keynotes") || [];
    const grid = document.getElementById("openmindx-keynotes");
    if (grid) {
      grid.innerHTML = keynotes
        .map(
          (k) => `
        <article class="card">
          <span class="card-tag">${esc(k.tag)}</span>
          <h3>${esc(k.title)}</h3>
          <p>${esc(k.desc)}</p>
        </article>`
        )
        .join("");
    }
  }

  function renderIdeationWorX() {
    const programs = c("ideationworx.programs") || [];
    const list = document.getElementById("ideationworx-programs");
    if (list) {
      list.innerHTML = programs.map((p) => `<li>${esc(p)}</li>`).join("");
    }
  }

  function renderLumiereX() {
    const retreats = c("lumierex.retreats") || [];
    const grid = document.getElementById("lumierex-retreats");
    if (grid) {
      grid.innerHTML = retreats
        .map(
          (r) => `
        <article class="card">
          <span class="card-tag">${esc(r.tag)}</span>
          <h3>${esc(r.title)}</h3>
          <p class="card-location">${esc(r.location)}</p>
          <p class="card-status">${esc(r.status)}</p>
          <p>${esc(r.desc)}</p>
          <a href="contact.html" class="card-link">${esc(r.cta)}</a>
        </article>`
        )
        .join("");
    }
  }

  function renderAbout() {
    const howCards = c("about.howCards") || [];
    const howGrid = document.getElementById("about-how-cards");
    if (howGrid) {
      howGrid.innerHTML = howCards
        .map((card) => `<article class="card"><h3>${esc(card.title)}</h3><p>${esc(card.desc)}</p></article>`)
        .join("");
    }

    const values = c("about.values") || [];
    const valuesList = document.getElementById("about-values");
    if (valuesList) {
      valuesList.innerHTML = values.map((v) => `<li>${esc(v)}</li>`).join("");
    }

    const founderLink = document.getElementById("founder-link");
    const founderWebsite = document.getElementById("founder-website");
    const url = c("about.founderUrl");
    if (founderLink && url) founderLink.href = url;
    if (founderWebsite && url) founderWebsite.href = url;

    const team = window.CONTENT?.team || [];
    const teamGrid = document.getElementById("team-grid");
    if (teamGrid) {
      teamGrid.innerHTML = team
        .map(
          (t) => `
        <article class="card team-card">
          <h3>${esc(t.name)}</h3>
          <p class="role">${esc(t.role)}</p>
          <p>${esc(t.bio)}</p>
        </article>`
        )
        .join("");
    }
  }

  function initContactForm() {
    const form = document.getElementById("contact-form");
    const msg = document.getElementById("contact-message");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = data.get("name")?.toString().trim();
      const email = data.get("email")?.toString().trim();
      const message = data.get("message")?.toString().trim();

      if (!name || !email || !message) {
        showMsg("Please fill in all required fields.", "error");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMsg("Please enter a valid email address.", "error");
        return;
      }
      showMsg(`Thank you, ${name}. Your enquiry has been recorded. We'll be in touch.`, "success");
      form.reset();
    });

    function showMsg(text, type) {
      msg.textContent = text;
      msg.hidden = false;
      msg.className = `form-message is-${type}`;
    }
  }

  function initReveal() {
    document.querySelectorAll(".reveal").forEach((el) => {
      if (!("IntersectionObserver" in window)) {
        el.classList.add("is-visible");
        return;
      }
    });
    const els = document.querySelectorAll(".reveal");
    if (!els.length || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => obs.observe(el));
  }

  function initApp() {
    window.UtopiaLayout?.render();
    if (!window.CONTENT) return;
    window.ContentStore?.applyCmsBindings?.();
    initReveal();
    initContactForm();
    initMediaFilters();

    const experiences = window.CONTENT?.experiences || [];

    if (PAGE === "xperiences") {
      initPagination(
        "experiences-grid",
        experiences,
        (x) => `
        <article class="card experience-card">
          <span class="card-tag">${esc(x.tag)}</span>
          <h3>${esc(x.title)}</h3>
          <p class="card-location">${esc(x.location)}</p>
          <p class="card-status">${esc(x.status)}</p>
          <p>${esc(x.desc)}</p>
          <a href="contact.html" class="card-link">Enquire</a>
        </article>`
      );
    }

    if (PAGE === "home") {
      const featured = document.getElementById("home-experiences");
      const recent = document.getElementById("home-media");
      const mediaItems = window.CONTENT?.mediaItems || [];
      if (featured) {
        featured.innerHTML = experiences
          .slice(0, 3)
          .map(
            (x) => `
          <article class="card">
            <span class="card-tag">${esc(x.tag)}</span>
            <h3>${esc(x.title)}</h3>
            <p>${esc(x.desc)}</p>
            <a href="xperiences.html" class="card-link">View all Xperiences</a>
          </article>`
          )
          .join("");
      }
      if (recent) {
        recent.innerHTML = validMediaItems(mediaItems)
          .slice(0, 3)
          .map(
            (m) => `
          <article class="card">
            <span class="card-meta">${esc(m.date)} · ${esc(m.category)}</span>
            <h3>${esc(m.title)}</h3>
            <p>${esc(m.excerpt)}</p>
            <a href="media.html" class="card-link">View Media</a>
          </article>`
          )
          .join("");
      }
    }

    if (PAGE === "openmindx") renderOpenMindX();
    if (PAGE === "ideationworx") renderIdeationWorX();
    if (PAGE === "lumierex") renderLumiereX();
    if (PAGE === "about") renderAbout();
  }

  document.addEventListener("contentready", initApp);
})();
