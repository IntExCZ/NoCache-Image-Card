
/**
 * NoCache Image Card for Home Assistant
 * Autor: IntEx
 * Verze: 1.0.0
 * Popis: Zobrazuje obrázek z URL přes celou kartu a zabraňuje cachování přidáním unikátního query parametru.
 *        Podpora tap_action (pouze YAML), zachováno původní chování při absenci tap_action (refresh).
 */

class NoCacheImageCard extends HTMLElement {
  constructor() {
    super();
    this.config = null;
    this.card = null;
    this.wrapper = null;
    this.inner = null;
    this.img = null;
    this.err = null;
    this.placeholder = null;
    this.timer = null;
    this.observer = null;
    this.lastToken = null;

    this._boundOnCardClick = this._onCardClick.bind(this);
  }

  _buildCardIfNeeded() {
    if (this.card) return;

    this.innerHTML = `
      <ha-card>
        <div id="wrapper" style="
          position: relative;
          width: 100%;
          background: transparent;
          box-sizing: border-box;
        ">
          <div id="inner" style="
            box-sizing: border-box;
            padding: 0;
          ">
            <!-- Placeholder popis (zobrazí se, když není URL) -->
            <div id="placeholder" style="
              display: none;
              width: 100%;
              min-height: 140px;
              max-width: 100%;
              box-sizing: border-box;
              padding: 16px;
              color: var(--primary-text-color);
              background: transparent;
              font-size: 14px;
              line-height: 1.5;
              text-align: left;
              border: 1px dashed var(--divider-color);
              border-radius: 6px;
              margin: 16px auto;
              display: flex;
              align-items: center;
              justify-content: center;
              white-space: normal;
              word-break: break-word;
              overflow-wrap: anywhere;
            ">
              <div style="max-width: 680px; margin: 0 auto; opacity:.9;">
                <div style="font-weight:700; margin-bottom:6px;">NoCache Image</div>
                <ul style="margin:0; padding-left:18px;">
                  <li>Zobrazuje obrázek z konfigurovatelné URL.</li>
                  <li>Obchází cache prohlížeče: přidává <code>?cb=&lt;token&gt;</code> při každém načtení.</li>
                  <li>Volitelně: automatické obnovení (<code>refresh_interval</code>) a obnovení při zobrazení (<code>reload_on_visibility</code>).</li>
                  <li>Podporuje <code>image_height</code> (např. <em>300px</em>, <em>50vh</em>) nebo <code>aspect_ratio</code> (např. <em>16 / 9</em>).</li>
                  <li>Per‑side padding: <code>image_padding_top/right/bottom/left</code>.</li>
                  <li>YAML-only <code>tap_action</code> (more-info, navigate, url, call-service, fire-dom-event, none, reload).</li>
                </ul>
              </div>
            </div>

            <img id="img" style="
              display: none;              /* skryté, dokud není URL/načteno */
              width: 100%;
              height: auto;              /* default: přirozená výška obrázku */
              object-fit: contain;       /* při auto výšce je object-fit spíše symbolický */
            " decoding="async" loading="eager" fetchpriority="high" />
            <div id="error" style="
              display: none;
              width: 100%;
              padding: 8px;
              color: var(--error-color, #f00);
              background: rgba(255,0,0,0.1);
              box-sizing: border-box;
            ">Obrázek se nepodařilo načíst.</div>
          </div>
        </div>
      </ha-card>
    `;

    this.card        = this.querySelector('ha-card');
    this.wrapper     = this.querySelector('#wrapper');
    this.inner       = this.querySelector('#inner');
    this.img         = this.querySelector('#img');
    this.err         = this.querySelector('#error');
    this.placeholder = this.querySelector('#placeholder');

    // Klik (tap): pokud je tap_action v YAML › provede se; jinak refresh (původní chování)
    this.card.addEventListener('click', this._boundOnCardClick);

    // Načítání/chyby
    this.img.addEventListener('load', () => {
      if (this.err) this.err.style.display = 'none';
      if (this.placeholder) this.placeholder.style.display = 'none';
      this.img.style.display = 'block';
      // Pokud není definován image_height ani aspect_ratio, držíme height:auto
      if (!this.config || (!this.config.image_height && !this.config.aspect_ratio)) {
        this.img.style.height = 'auto';
        this.img.style.objectFit = 'contain'; // spíš kosmetické
        this.wrapper.style.overflow = 'visible';
        this.wrapper.style.aspectRatio = ''; // žádný fixní poměr
      }
    });
    this.img.addEventListener('error', () => {
      if (this.config && this.config.url) {
        if (this.err) this.err.style.display = 'block';
        this.img.style.display = 'none';
        if (this.placeholder) this.placeholder.style.display = 'none';
      } else {
        // Bez URL – v náhledu „Přidat kartu“ zobrazuj popis
        if (this.err) this.err.style.display = 'none';
        this.img.style.display = 'none';
        if (this.placeholder) this.placeholder.style.display = 'flex';
      }
    });
  }

  _cacheBustedUrl(url, token) {
    try {
      const u = new URL(url, location.href);
      u.searchParams.set('cb', token);
      return u.toString();
    } catch {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}cb=${encodeURIComponent(token)}`;
    }
  }

  _generateToken(forceNew = false) {
    if (!forceNew && this.lastToken) return this.lastToken;
    const t = Date.now().toString(); // timestamp je dostačující; lze použít crypto.randomUUID()
    this.lastToken = t;
    return t;
  }

  _refreshImage(forceNewToken = false) {
    if (!this.config || !this.img) return;

    // Placeholder režim (bez URL)
    if (!this.config.url) {
      if (this.placeholder) this.placeholder.style.display = 'flex';
      if (this.err) this.err.style.display = 'none';
      this.img.style.display = 'none';
      return;
    }

    const token = this._generateToken(forceNewToken);
    const src = this._cacheBustedUrl(this.config.url, token);

    if (this.img.src !== src) {
      this.img.src = src;
    } else if (forceNewToken) {
      // vynutíme reload i když src náhodou sedí
      this.img.src = '';
      requestAnimationFrame(() => (this.img.src = src));
    }
  }

  _setupTimer() {
    this._teardownTimer();
    const intervalSec = Number((this.config && this.config.refresh_interval) || 0);
    if (intervalSec > 0) {
      this.timer = setInterval(() => this._refreshImage(true), intervalSec * 1000);
    }
  }

  _teardownTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  _setupVisibilityObserver() {
    this._teardownVisibilityObserver();
    if (!(this.config && this.config.reload_on_visibility)) return;

    this.observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === this && e.isIntersecting) {
          this._refreshImage(true);
        }
      }
    }, { root: null, threshold: 0.01 });

    this.observer.observe(this);
  }

  _teardownVisibilityObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  _applyStyles() {
    const cfg = this.config || {};

    // Pokud není URL → placeholder (náhled v „Přidat kartu“)
    if (!cfg.url) {
      if (this.placeholder) this.placeholder.style.display = 'flex';
      if (this.err) this.err.style.display = 'none';
      this.img.style.display = 'none';

      this.wrapper.style.background = cfg.background ?? 'transparent';
      const pad = this._resolvePadding(cfg);
      this.inner.style.paddingTop    = pad.image_padding_top;
      this.inner.style.paddingRight  = pad.image_padding_right;
      this.inner.style.paddingBottom = pad.image_padding_bottom;
      this.inner.style.paddingLeft   = pad.image_padding_left;

      this.wrapper.style.aspectRatio = '';
      this.wrapper.style.overflow = 'visible';
      return;
    }

    // Pozadí wrapperu (za obrázkem)
    this.wrapper.style.background = cfg.background ?? 'transparent';

    // Per-side padding na vnitřním kontejneru
    const pad2 = this._resolvePadding(cfg);
    this.inner.style.paddingTop    = pad2.image_padding_top;
    this.inner.style.paddingRight  = pad2.image_padding_right;
    this.inner.style.paddingBottom = pad2.image_padding_bottom;
    this.inner.style.paddingLeft   = pad2.image_padding_left;

    // Řešení výšky/cover/contain:
    const fit = (cfg.fit || 'cover').toLowerCase();
    const hasFixedHeight = !!(cfg.image_height || cfg.aspect_ratio);

    if (hasFixedHeight) {
      if (cfg.aspect_ratio) {
        // Poměr stran kontejneru; IMG se roztáhne do 100% výšky
        this.wrapper.style.aspectRatio = cfg.aspect_ratio;
        this.img.style.height = '100%';
        this.img.style.width = '100%';
      } else {
        // Použijeme explicitní výšku obrázku
        this.wrapper.style.aspectRatio = '';
        this.img.style.height = String(cfg.image_height);
        this.img.style.width = '100%';
      }
      this.img.style.objectFit = fit;
      this.wrapper.style.overflow = fit === 'cover' ? 'hidden' : 'visible';
    } else {
      // Přirozená výška obrázku
      this.wrapper.style.aspectRatio = '';
      this.img.style.width = '100%';
      this.img.style.height = 'auto';
      this.img.style.objectFit = 'contain';
      this.wrapper.style.overflow = 'visible';
    }

    // kurzor podle přítomnosti tap_action
      this._applyCursor(cfg);
  }

  // ---- TAP ACTIONS (YAML-only) ------------------------------------------------

  _onCardClick(ev) {
    if (this.config && this.config.tap_action) {
      this._performAction(this.config.tap_action, ev);
      return;
    }
    // fallback: původní chování
    this._refreshImage(true);
  }

  _performAction(actionCfg, ev) {
    if (!actionCfg || !actionCfg.action) {
      this._refreshImage(true);
      return;
    }
    const a = String(actionCfg.action).toLowerCase();

    switch (a) {
      case 'none':
        // nedělej nic
        break;

      case 'reload':
        // vlastní, ekvivalent původního kliknutí
        this._refreshImage(true);
        break;

      case 'more-info': {
        const entityId = actionCfg.entity || actionCfg.entity_id || actionCfg.entityId;
        if (entityId) {
          this.dispatchEvent(
            new CustomEvent('hass-more-info', {
              bubbles: true,
              composed: true,
              detail: { entityId },
            })
          );
        }
        break;
      }

      case 'navigate': {
        const path = actionCfg.navigation_path || actionCfg.path;
        if (path) {
          this.dispatchEvent(
            new CustomEvent('hass-navigate', {
              bubbles: true,
              composed: true,
              detail: { path },
            })
          );
        }
        break;
      }

      case 'url': {
        const url = actionCfg.url_path || actionCfg.url;
        if (url) {
          const target = actionCfg.target || '_blank';
          window.open(url, target);
        }
        break;
      }

      case 'call-service': {
        if (!this.hass) return;
        const full = actionCfg.service || '';
        const [domain, service] = full.split('.', 2);
        const data = actionCfg.service_data || actionCfg.data || {};
        if (domain && service) {
          this.hass.callService(domain, service, data);
        }
        break;
      }

      case 'fire-dom-event': {
        const evName = actionCfg.event_name || actionCfg.event || 'll-custom';
        const detail = actionCfg.event_detail || actionCfg.detail || {};
        this.dispatchEvent(
          new CustomEvent(evName, {
            bubbles: true,
            composed: true,
            detail,
          })
        );
        break;
      }

      default:
        // neznámá akce › zachovej původní chování
        this._refreshImage(true);
    }
  }
  
  
  // ---- kurzor podle tap_action -----------------------------------------------
  _applyCursor(cfg) {
    const isInteractive = !!(cfg && cfg.tap_action && cfg.tap_action.action && cfg.tap_action.action !== 'none');
    const cursorStyle = isInteractive ? 'pointer' : 'default';

    if (this.wrapper) this.wrapper.style.cursor = cursorStyle;
    if (this.card) this.card.style.cursor = cursorStyle;
    if (this.img) this.img.style.cursor = cursorStyle;

    // ARIA nápověda (není nutné, ale zlepšuje přístupnost)
    if (this.card) {
      if (isInteractive) {
        this.card.setAttribute('role', 'button');
        this.card.setAttribute('aria-label', 'Interaktivní obrázek');
      } else {
        this.card.removeAttribute('role');
        this.card.removeAttribute('aria-label');
      }
    }
  }


  // ---- HA lifecycle -----------------------------------------------------------

  set hass(hass) {
    this._hass = hass;
    this._buildCardIfNeeded();
    if (this.config && this.img && this.wrapper && this.inner) {
      this._applyStyles();
    }
    // Průběžně aktualizujeme bez vynucení nového tokenu
    this._refreshImage(false);
  }

  get hass() {
    return this._hass;
  }

  setConfig(config) {
    // URL může být prázdná (placeholder v náhledu „Přidat kartu“)
    if (!config) config = {};

    // Normalizace konfigurace (bez zaoblení/rámečku/shorthand)
    const base = {
      url: config.url || '',
      fit: config.fit || 'cover',
      refresh_interval: Number(config.refresh_interval || 0),
      reload_on_visibility: config.reload_on_visibility !== false, // default true
      background: config.background ?? 'transparent',
      image_height: config.image_height ?? '',       // např. '300px' | '50vh'
      aspect_ratio: config.aspect_ratio ?? '',       // např. '16 / 9' nebo '1.77'
      // YAML-only tap_action – přebíráme beze změny, UI editor jej nezobrazuje
      tap_action: config.tap_action,
    };

    const perSide = this._resolvePadding(config);
    this.config = Object.assign({}, base, perSide);

    this._buildCardIfNeeded();
    this._setupTimer();
    this._setupVisibilityObserver();
    this._applyStyles();
    this._refreshImage(Boolean(this.config.url));
  }

  // Per-side padding (bez shorthand)
  _resolvePadding(cfg) {
    return {
      image_padding_top:    cfg.image_padding_top    ?? '0',
      image_padding_right:  cfg.image_padding_right  ?? '0',
      image_padding_bottom: cfg.image_padding_bottom ?? '0',
      image_padding_left:   cfg.image_padding_left   ?? '0',
    };
  }

  static getStubConfig() {
    return {
      url: '', // prázdné: v „Přidat kartu“ zobrazíme popis karty
      fit: 'cover',
      refresh_interval: 0,
      reload_on_visibility: true,
      background: 'transparent',
      image_height: '',
      aspect_ratio: '',
      // pouze per-side padding
      image_padding_top: '0',
      image_padding_right: '0',
      image_padding_bottom: '0',
      image_padding_left: '0',
      // tap_action záměrně neuvádíme – YAML-only
    };
  }

  static getConfigElement() {
    return new NoCacheImageCardEditor();
  }

  getCardSize() {
    return 3;
  }

  disconnectedCallback() {
    this._teardownTimer();
    this._teardownVisibilityObserver();
    if (this.card && this._boundOnCardClick) {
      this.card.removeEventListener('click', this._boundOnCardClick);
    }
  }
}

// Registrace custom elementu (bez prefixu 'custom:')
customElements.define('nocache-image-card', NoCacheImageCard);

// Registrace do katalogu „Přidat kartu“
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'nocache-image-card',
  name: 'NoCache Image',
  description:
    'Obrázek z URL s cache-busting v1.0.0 – IntEx',
  preview: true,
});

/** -----------------------
 *  Jednoduchý GUI editor
 *  -----------------------
 */
class NoCacheImageCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = NoCacheImageCard.getStubConfig();
    this._root = null;
    this._isConnected = false;        // sledujeme připojení do DOM
  }

  connectedCallback() {
    if (!this._root) {
      this._isConnected = true;
      this.innerHTML = `
        <style>
          .row { display: flex; gap: 12px; margin-bottom: 12px; }
          .col { flex: 1; }
          label { display:block; font-weight: 600; margin-bottom: 4px; }
          input, select { width: 100%; box-sizing: border-box; padding: 6px 8px; }
          small { color: var(--secondary-text-color); }
          .footer { margin-top: 8px; color: var(--secondary-text-color); font-size: 12px; }
        </style>

        <div class="row">
          <div class="col">
            <label>URL obrázku</label>
            <input id="url" type="text" placeholder="https://example.com/image.jpg">
            <small>Musí být dostupná z prohlížeče (CORS/HTTPS).</small>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>Object-fit</label>
            <select id="fit">
              <option value="cover">cover</option>
              <option value="contain">contain</option>
              <option value="fill">fill</option>
              <option value="none">none</option>
              <option value="scale-down">scale-down</option>
            </select>
          </div>
          <div class="col">
            <label>Interval obnovení (s)</label>
            <input id="refresh_interval" type="number" min="0" step="1">
            <small>0 = bez periodického obnovení</small>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>Obnovit při zobrazení</label>
            <select id="reload_on_visibility">
              <option value="true">Ano</option>
              <option value="false">Ne</option>
            </select>
          </div>
          <div class="col">
            <label>Pozadí karty</label>
            <input id="background" type="text" placeholder="transparent | #000 | rgba(...)">
          </div>
        </div>

        <!-- Pouze per-side padding -->
        <div class="row">
          <div class="col">
            <label>Top</label>
            <input id="image_padding_top" type="text" placeholder="např. 12px">
          </div>
          <div class="col">
            <label>Right</label>
            <input id="image_padding_right" type="text" placeholder="např. 12px">
          </div>
          <div class="col">
            <label>Bottom</label>
            <input id="image_padding_bottom" type="text" placeholder="např. 12px">
          </div>
          <div class="col">
            <label>Left</label>
            <input id="image_padding_left" type="text" placeholder="např. 12px">
          </div>
        </div>

        <!-- Výška/parametr poměru -->
        <div class="row">
          <div class="col">
            <label>Výška obrázku</label>
            <input id="image_height" type="text" placeholder="např. 300px | 50vh">
            <small>Pokud vyplníte, aktivuje se object-fit a ořez (cover/contain).</small>
          </div>
          <div class="col">
            <label>Poměr stran (aspect-ratio)</label>
            <input id="aspect_ratio" type="text" placeholder="např. 16 / 9 nebo 1.77">
            <small>Alternativa k výšce – určí výšku z šířky karty.</small>
          </div>
        </div>

        <div class="footer">v1.0.0 – IntEx</div>
      `;
      this._root = this;
      this._bind();                    // může bezpečně volat querySelector
      this._render();                  // render pouze když DOM existuje
    }
  }

  setConfig(config) {
    // Sloučení bez shorthand paddingu
    const base = NoCacheImageCard.getStubConfig();
    const c = Object.assign({}, base, config || {});
    this._config = c;
    // pokud ještě není připojeno do DOM, jen si ulož config; render až v connectedCallback
    if (this._isConnected && this._root) {
      this._render();
    }
  }

  _bind() {
    // obrana – pokud _root není připraven, neprovádět bind (HA nás připojí později)
    if (!this._root) return;
    const $ = (sel) => this._root.querySelector(sel);

    $('#url')?.addEventListener('input', (e) => this._update({ url: e.target.value }));
    $('#fit')?.addEventListener('change', (e) => this._update({ fit: e.target.value }));
    $('#refresh_interval')?.addEventListener('input', (e) => this._update({ refresh_interval: Number(e.target.value || 0) }));
    $('#reload_on_visibility')?.addEventListener('change', (e) => this._update({ reload_on_visibility: e.target.value === 'true' }));
    $('#background')?.addEventListener('input', (e) => this._update({ background: e.target.value }));

    // Per-side padding
    $('#image_padding_top')?.addEventListener('input', (e) => this._update({ image_padding_top: e.target.value }));
    $('#image_padding_right')?.addEventListener('input', (e) => this._update({ image_padding_right: e.target.value }));
    $('#image_padding_bottom')?.addEventListener('input', (e) => this._update({ image_padding_bottom: e.target.value }));
    $('#image_padding_left')?.addEventListener('input', (e) => this._update({ image_padding_left: e.target.value }));

    // Výška / poměr stran
    $('#image_height')?.addEventListener('input', (e) => this._update({ image_height: e.target.value }));
    $('#aspect_ratio')?.addEventListener('input', (e) => this._update({ aspect_ratio: e.target.value }));
  }

  _render() {
    // obrana – bez DOM neprovádět render
    if (!this._root) return;
    const c = this._config || NoCacheImageCard.getStubConfig();
    const setVal = (sel, val) => {
      const el = this._root.querySelector(sel);
      if (el) el.value = val;
    };
    
    setVal('#url', c.url ?? '');
    setVal('#fit', c.fit ?? 'cover');
    setVal('#refresh_interval', Number(c.refresh_interval || 0));
    setVal('#reload_on_visibility', String(c.reload_on_visibility !== false));
    setVal('#background', c.background ?? 'transparent');

    // Per-side padding
    setVal('#image_padding_top', c.image_padding_top ?? '0');
    setVal('#image_padding_right', c.image_padding_right ?? '0');
    setVal('#image_padding_bottom', c.image_padding_bottom ?? '0');
    setVal('#image_padding_left', c.image_padding_left ?? '0');

    // Výška / poměr stran
    setVal('#image_height', c.image_height ?? '');
    setVal('#aspect_ratio', c.aspect_ratio ?? '');
  }

  _update(patch) {
    this._config = Object.assign({}, this._config, patch);
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
  }
}

customElements.define('nocache-image-card-editor', NoCacheImageCardEditor);
