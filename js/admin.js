(function () {
  const TOKEN_KEY = "utopiax_admin_token";
  const OFFLINE_TOKEN = "utopiax-offline-cms";
  const CMS_STORAGE_KEY = "utopiax_cms_override";

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(t) {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  function deepMerge(target, source) {
    if (!source) return target;
    Object.keys(source).forEach((key) => {
      const sv = source[key];
      const tv = target[key];
      if (sv && typeof sv === "object" && !Array.isArray(sv)) {
        if (!tv || typeof tv !== "object") target[key] = {};
        deepMerge(target[key], sv);
      } else {
        target[key] = sv;
      }
    });
    return target;
  }

  let configPromise = null;
  function getConfig() {
    if (!configPromise) {
      configPromise = (async () => {
        const urls = ["../config.json", "/config.json", "config.json"];
        for (const url of urls) {
          try {
            const res = await fetch(url);
            if (res.ok) return res.json();
          } catch (_) {
            /* try next */
          }
        }
        return { adminUser: "admin", adminPassword: "utopiax-admin" };
      })();
    }
    return configPromise;
  }

  function validMediaList(arr) {
    return (arr || []).filter((m) => m && (m.title || "").trim());
  }

  async function loadContentForCms() {
    const urls = ["../content.json", "/content.json", "./content.json", "content.json"];
    let fileBase = null;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          fileBase = await res.json();
          break;
        }
      } catch (_) {
        /* try next */
      }
    }
    if (!fileBase) throw new Error("Could not load content.json");

    let base = JSON.parse(JSON.stringify(fileBase));
    try {
      const raw = localStorage.getItem(CMS_STORAGE_KEY);
      if (raw) base = deepMerge(base, JSON.parse(raw));
    } catch (_) {
      /* ignore bad override */
    }

    const merged = validMediaList(base.mediaItems);
    const defaults = validMediaList(fileBase.mediaItems);
    base.mediaItems = merged.length ? merged : defaults;

    if (!merged.length && defaults.length) {
      try {
        const raw = localStorage.getItem(CMS_STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw);
          stored.mediaItems = defaults;
          localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(stored));
        }
      } catch (_) {
        /* ignore */
      }
    }

    return base;
  }

  async function offlineApi(path, options = {}) {
    if (path === "/api/auth/login" && options.method === "POST") {
      const body = JSON.parse(options.body || "{}");
      const config = await getConfig();
      if (body.username === config.adminUser && body.password === config.adminPassword) {
        setToken(OFFLINE_TOKEN);
        return { token: OFFLINE_TOKEN, user: config.adminUser };
      }
      throw new Error("Invalid username or password");
    }
    if (path === "/api/auth/me") {
      if (getToken() === OFFLINE_TOKEN) return { user: "admin" };
      throw new Error("Unauthorized");
    }
    if (path === "/api/auth/logout") {
      return { ok: true };
    }
    if (path === "/api/content" && (!options.method || options.method === "GET")) {
      return loadContentForCms();
    }
    if (path === "/api/content" && options.method === "PUT") {
      localStorage.setItem(CMS_STORAGE_KEY, options.body);
      return { ok: true, message: "Saved in this browser." };
    }
    throw new Error("Not available without the server");
  }

  async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getToken();
    if (token && token !== OFFLINE_TOKEN) headers.Authorization = `Bearer ${token}`;

    if (token === OFFLINE_TOKEN) {
      return offlineApi(path, options);
    }

    try {
      const res = await fetch(path, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      if (res.status === 404 || res.status === 0) throw new TypeError("offline");
      throw new Error(data.error || "Request failed");
    } catch (err) {
      if (path.startsWith("/api/")) {
        return offlineApi(path, options);
      }
      throw err;
    }
  }

  function field(label, path, value, type = "text") {
    const id = path.replace(/\./g, "-");
    if (type === "textarea") {
      return `<div><label for="${id}">${label}</label><textarea id="${id}" data-path="${path}">${escapeHtml(value || "")}</textarea></div>`;
    }
    return `<div><label for="${id}">${label}</label><input type="${type}" id="${id}" data-path="${path}" value="${escapeAttr(value || "")}" /></div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function getByPath(obj, path) {
    return path.split(".").reduce((o, k) => (o != null ? o[k] : undefined), obj);
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

  function collectFields(root, content) {
    root.querySelectorAll("[data-path]").forEach((el) => {
      setByPath(content, el.dataset.path, el.value);
    });
  }

  // --- Login page ---
  if (document.getElementById("login-form")) {
    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("login-message");
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      try {
        const data = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        setToken(data.token);
        window.location.href = "dashboard.html";
      } catch (err) {
        msg.textContent = err.message;
        msg.hidden = false;
        msg.className = "form-message is-error";
      }
    });
    if (getToken()) {
      api("/api/auth/me")
        .then(() => {
          window.location.href = "dashboard.html";
        })
        .catch(() => setToken(null));
    }

    return;
  }

  // --- Dashboard ---
  if (!document.getElementById("admin-panels")) return;

  let content = null;
  const panelsEl = document.getElementById("admin-panels");
  const saveStatus = document.getElementById("save-status");
  const panelTitle = document.getElementById("panel-title");

  const panelTitles = {
    site: "Site & contact",
    home: "Homepage",
    openmindx: "OpenMindX",
    ideationworx: "IdeationWorX",
    lumierex: "LumiereX",
    about: "About & founder",
    contact: "Contact page",
    experiences: "Xperiences",
    media: "Media",
    team: "Team",
  };

  async function requireAuth() {
    if (!getToken()) {
      window.location.href = "index.html";
      return false;
    }
    try {
      await api("/api/auth/me");
      return true;
    } catch {
      setToken(null);
      window.location.href = "index.html";
      return false;
    }
  }

  function renderSitePanel() {
    const s = content.site;
    return `<section class="admin-panel is-active" data-panel="site">
      <div class="field-grid">
        ${field("Footer tagline", "site.footerTagline", s.footerTagline)}
        ${field("Footer location", "site.footerLocation", s.footerLocation)}
        ${field("Phone display", "site.phone", s.phone)}
        ${field("Phone link (digits)", "site.phoneHref", s.phoneHref)}
        ${field("Email", "site.email", s.email, "email")}
        ${field("Newsletter title", "site.newsletterTitle", s.newsletterTitle)}
        ${field("Newsletter description", "site.newsletterDesc", s.newsletterDesc, "textarea")}
      </div>
    </section>`;
  }

  function renderHomePanel() {
    const h = content.home;
    return `<section class="admin-panel" data-panel="home">
      <div class="field-grid">
        ${field("Hero eyebrow", "home.heroEyebrow", h.heroEyebrow)}
        ${field("Hero title", "home.heroTitle", h.heroTitle)}
        ${field("Hero lead", "home.heroLead", h.heroLead, "textarea")}
        ${field("Pillars eyebrow", "home.pillarsEyebrow", h.pillarsEyebrow)}
        ${field("Pillars title", "home.pillarsTitle", h.pillarsTitle)}
        ${field("Pillars description", "home.pillarsDesc", h.pillarsDesc, "textarea")}
        ${field("OpenMindX blurb", "home.pillarOpenMindX", h.pillarOpenMindX, "textarea")}
        ${field("IdeationWorX blurb", "home.pillarIdeationWorX", h.pillarIdeationWorX, "textarea")}
        ${field("LumiereX blurb", "home.pillarLumiereX", h.pillarLumiereX, "textarea")}
        ${field("Centres eyebrow", "home.centresEyebrow", h.centresEyebrow)}
        ${field("Centres title", "home.centresTitle", h.centresTitle)}
        ${field("Centres description", "home.centresDesc", h.centresDesc, "textarea")}
        ${field("CTA title", "home.ctaTitle", h.ctaTitle)}
        ${field("CTA description", "home.ctaDesc", h.ctaDesc, "textarea")}
      </div>
    </section>`;
  }

  function renderPagePanel(key, fields) {
    const p = content[key];
    const html = fields.map(([label, k, type]) => field(label, `${key}.${k}`, p[k], type || "text")).join("");
    return `<section class="admin-panel" data-panel="${key}"><div class="field-grid">${html}</div></section>`;
  }

  function renderKeynotesPanel() {
    const k = content.openmindx.keynotes || [];
    return `<section class="admin-panel" data-panel="openmindx">
      ${renderPagePanel("openmindx", [
        ["Eyebrow", "eyebrow"],
        ["Title", "title"],
        ["Lead", "lead", "textarea"],
        ["Body 1", "body1", "textarea"],
        ["Body 2", "body2", "textarea"],
        ["Quote", "quote", "textarea"],
        ["Keynotes heading", "keynotesTitle"],
      ]).replace(/<section[^>]*>|<\/section>/g, "")}
      <h3 style="margin-top:2rem;font-family:var(--font-display)">Featured keynotes</h3>
      <div class="list-editor" id="keynotes-list">${k.map((item, i) => keynoteItem(item, i)).join("")}</div>
      <button type="button" class="btn btn-secondary btn-sm" id="add-keynote" style="margin-top:1rem">+ Add keynote</button>
    </section>`;
  }

  function keynoteItem(item, i) {
    return `<div class="list-item" data-list="openmindx.keynotes" data-index="${i}">
      <div class="list-item-header"><strong>Keynote ${i + 1}</strong><button type="button" class="btn btn-danger btn-sm" data-remove>Remove</button></div>
      <div class="field-grid">
        ${field("Tag", `openmindx.keynotes.${i}.tag`, item.tag)}
        ${field("Title", `openmindx.keynotes.${i}.title`, item.title)}
        ${field("Description", `openmindx.keynotes.${i}.desc`, item.desc, "textarea")}
      </div>
    </motion>`;
  }

  function renderExperiencesPanel() {
    return `<section class="admin-panel" data-panel="experiences">
      ${field("Page eyebrow", "xperiences.eyebrow", content.xperiences.eyebrow)}
      ${field("Page title", "xperiences.title", content.xperiences.title)}
      ${field("Page lead", "xperiences.lead", content.xperiences.lead, "textarea")}
      <div class="list-editor" id="experiences-list" style="margin-top:1.5rem">
        ${(content.experiences || []).map((x, i) => experienceItem(x, i)).join("")}
      </div>
      <button type="button" class="btn btn-secondary btn-sm" id="add-experience" style="margin-top:1rem">+ Add Xperience</button>
    </section>`;
  }

  function experienceItem(x, i) {
    return `<div class="list-item" data-index="${i}">
      <div class="list-item-header"><strong>${escapeHtml(x.title || "Xperience")}</strong><button type="button" class="btn btn-danger btn-sm" data-remove>Remove</button></div>
      <div class="field-grid">
        ${field("Title", `experiences.${i}.title`, x.title)}
        ${field("Tag", `experiences.${i}.tag`, x.tag)}
        ${field("Location", `experiences.${i}.location`, x.location)}
        ${field("Status", `experiences.${i}.status`, x.status)}
        ${field("Description", `experiences.${i}.desc`, x.desc, "textarea")}
      </div>
    </motion>`;
  }

  function mediaItem(m, i) {
    return `<div class="list-item" data-index="${i}">
      <motion class="list-item-header"><strong>${escapeHtml(m.title || "Media")}</strong><button type="button" class="btn btn-danger btn-sm" data-remove>Remove</button></div>
      <div class="field-grid">
        ${field("Title", `mediaItems.${i}.title`, m.title)}
        ${field("Date", `mediaItems.${i}.date`, m.date)}
        ${field("Category", `mediaItems.${i}.category`, m.category)}
        ${field("Type", `mediaItems.${i}.type`, m.type)}
        ${field("Excerpt", `mediaItems.${i}.excerpt`, m.excerpt, "textarea")}
      </div>
    </motion>`;
  }

  function teamItem(t, i) {
    return `<div class="list-item" data-index="${i}">
      <div class="list-item-header"><strong>${escapeHtml(t.name || "Member")}</strong><button type="button" class="btn btn-danger btn-sm" data-remove>Remove</button></div>
      <div class="field-grid">
        ${field("Name", `team.${i}.name`, t.name)}
        ${field("Role", `team.${i}.role`, t.role)}
        ${field("Bio", `team.${i}.bio`, t.bio, "textarea")}
      </div>
    </motion>`;
  }

  function renderAllPanels() {
    const about = content.about;
    panelsEl.innerHTML = [
      renderSitePanel(),
      renderHomePanel(),
      renderKeynotesPanel(),
      renderPagePanel("ideationworx", [
        ["Eyebrow", "eyebrow"],
        ["Title", "title"],
        ["Lead", "lead", "textarea"],
        ["Design thinking title", "designTitle"],
        ["Design thinking body", "designBody", "textarea"],
        ["Moonshot title", "moonshotTitle"],
        ["Moonshot body", "moonshotBody", "textarea"],
        ["Programs title", "programsTitle"],
      ]),
      renderPagePanel("lumierex", [
        ["Eyebrow", "eyebrow"],
        ["Title", "title"],
        ["Lead", "lead", "textarea"],
        ["Body 1", "body1", "textarea"],
        ["Body 2", "body2", "textarea"],
        ["Retreats title", "retreatsTitle"],
      ]),
      `<section class="admin-panel" data-panel="about">
        <div class="field-grid">
          ${field("Eyebrow", "about.eyebrow", about.eyebrow)}
          ${field("Title", "about.title", about.title)}
          ${field("Lead", "about.lead", about.lead, "textarea")}
          ${field("Utopic title", "about.utopicTitle", about.utopicTitle)}
          ${field("Utopic paragraph 1", "about.utopicP1", about.utopicP1, "textarea")}
          ${field("Utopic paragraph 2", "about.utopicP2", about.utopicP2, "textarea")}
          ${field("How title", "about.howTitle", about.howTitle)}
          ${field("Values title", "about.valuesTitle", about.valuesTitle)}
          ${field("Founder name", "about.founderName", about.founderName)}
          ${field("Founder website URL", "about.founderUrl", about.founderUrl)}
          ${field("Founder bio 1", "about.founderBio1", about.founderBio1, "textarea")}
          ${field("Founder bio 2", "about.founderBio2", about.founderBio2, "textarea")}
          ${field("Founder link label", "about.founderLinkLabel", about.founderLinkLabel)}
          ${field("Team section title", "about.teamTitle", about.teamTitle)}
        </div>
        <h3 style="margin-top:2rem">Values (one per line in site — edit as list below)</h3>
        <div class="list-editor" id="values-list">${(about.values || []).map((v, i) => `<motion class="list-item"><div class="field-grid">${field(`Value ${i + 1}`, `about.values.${i}`, v)}</div></div>`).join("")}</div>
        <button type="button" class="btn btn-secondary btn-sm" id="add-value">+ Add value</button>
      </section>`,
      renderPagePanel("contact", [
        ["Eyebrow", "eyebrow"],
        ["Title", "title"],
        ["Lead", "lead", "textarea"],
        ["Heading", "heading"],
        ["Follow note", "followNote", "textarea"],
      ]),
      renderExperiencesPanel(),
      `<section class="admin-panel" data-panel="media">
        ${field("Eyebrow", "media.eyebrow", content.media.eyebrow)}
        ${field("Title", "media.title", content.media.title)}
        ${field("Lead", "media.lead", content.media.lead, "textarea")}
        <div class="list-editor" id="media-list" style="margin-top:1.5rem">${(content.mediaItems || []).map(mediaItem).join("")}</div>
        <button type="button" class="btn btn-secondary btn-sm" id="add-media">+ Add media item</button>
      </section>`,
      `<section class="admin-panel" data-panel="team">
        <div class="list-editor" id="team-list">${(content.team || []).map(teamItem).join("")}</div>
        <button type="button" class="btn btn-secondary btn-sm" id="add-team">+ Add team member</button>
      </section>`,
    ].join("");

    fixMotionTagsIn(panelsEl);
    bindListHandlers();
  }

  function fixMotionTagsIn(root) {
    root.innerHTML = root.innerHTML.split("motion").join("div");
  }

  function bindListHandlers() {
    panelsEl.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.closest(".list-item")?.remove();
      });
    });

    document.getElementById("add-experience")?.addEventListener("click", () => {
      const list = document.getElementById("experiences-list");
      const i = list.children.length;
      const wrap = document.createElement("template");
      wrap.innerHTML = experienceItem({ title: "", tag: "", location: "", status: "", desc: "" }, i);
      fixMotionTagsIn(wrap);
      list.appendChild(wrap.content.firstElementChild);
      bindListHandlers();
    });

    document.getElementById("add-media")?.addEventListener("click", () => {
      const list = document.getElementById("media-list");
      const i = list.children.length;
      const wrap = document.createElement("template");
      wrap.innerHTML = mediaItem({ title: "", date: "", category: "Innovation", type: "article", excerpt: "" }, i);
      fixMotionTagsIn(wrap);
      list.appendChild(wrap.content.firstElementChild);
      bindListHandlers();
    });

    document.getElementById("add-team")?.addEventListener("click", () => {
      const list = document.getElementById("team-list");
      const i = list.children.length;
      const wrap = document.createElement("template");
      wrap.innerHTML = teamItem({ name: "", role: "", bio: "" }, i);
      fixMotionTagsIn(wrap);
      list.appendChild(wrap.content.firstElementChild);
      bindListHandlers();
    });

    document.getElementById("add-keynote")?.addEventListener("click", () => {
      const list = document.getElementById("keynotes-list");
      const i = list.children.length;
      const wrap = document.createElement("template");
      wrap.innerHTML = keynoteItem({ tag: "", title: "", desc: "" }, i);
      fixMotionTagsIn(wrap);
      list.appendChild(wrap.content.firstElementChild);
      bindListHandlers();
    });

    document.getElementById("add-value")?.addEventListener("click", () => {
      const list = document.getElementById("values-list");
      const i = list.children.length;
      list.insertAdjacentHTML("beforeend", `<div class="list-item"><div class="field-grid">${field(`Value ${i + 1}`, `about.values.${i}`, "")}</div></div>`);
    });
  }

  function collectContentFromForm() {
    const updated = JSON.parse(JSON.stringify(content));
    collectFields(panelsEl, updated);

    updated.about.values = [];
    document.querySelectorAll('[data-path^="about.values."]').forEach((el) => {
      if (el.value.trim()) updated.about.values.push(el.value.trim());
    });

    updated.openmindx.keynotes = collectList("keynotes-list", ["tag", "title", "desc"]);
    updated.experiences = collectList("experiences-list", ["title", "tag", "location", "status", "desc"]);
    updated.mediaItems = collectList("media-list", ["title", "date", "category", "type", "excerpt"]).filter(
      (m) => (m.title || "").trim(),
    );
    updated.team = collectList("team-list", ["name", "role", "bio"]).filter((m) => (m.name || "").trim());

    return updated;
  }

  function collectList(listId, keys) {
    const list = document.getElementById(listId);
    if (!list) return [];
    return [...list.querySelectorAll(".list-item")].map((item) => {
      const obj = {};
      keys.forEach((k) => {
        const input = item.querySelector(`[data-path$=".${k}"]`);
        if (input) obj[k] = input.value;
      });
      return obj;
    });
  }

  function showPanel(name) {
    document.querySelectorAll("#admin-nav button").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.panel === name);
    });
    document.querySelectorAll(".admin-panel").forEach((p) => {
      p.classList.toggle("is-active", p.dataset.panel === name);
    });
    panelTitle.textContent = panelTitles[name] || name;
  }

  document.getElementById("admin-nav")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-panel]");
    if (btn) showPanel(btn.dataset.panel);
  });

  document.getElementById("save-btn")?.addEventListener("click", async () => {
    saveStatus.textContent = "Saving…";
    saveStatus.className = "save-status";
    try {
      const payload = collectContentFromForm();
      await api("/api/content", { method: "PUT", body: JSON.stringify(payload) });
      content = payload;
      if (getToken() !== OFFLINE_TOKEN) {
        try {
          localStorage.removeItem(CMS_STORAGE_KEY);
        } catch (_) {
          /* ignore */
        }
      }
      saveStatus.textContent =
        getToken() === OFFLINE_TOKEN
          ? "Saved in this browser — refresh the site to see changes"
          : "Saved successfully";
      saveStatus.className = "save-status is-ok";
    } catch (err) {
      saveStatus.textContent = err.message;
      saveStatus.className = "save-status is-err";
    }
  });

  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (_) {}
    setToken(null);
    window.location.href = "index.html";
  });

  (async function init() {
    if (!(await requireAuth())) return;
    content = await api("/api/content");
    renderAllPanels();
  })();
})();
