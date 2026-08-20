class AmobobaFooter extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;

    const side = this.getAttribute('logo-side') || 'random';
    const resolvedSide = side === 'random'
      ? (Math.random() < 0.5 ? 'left' : 'right')
      : side;
    const telegram = this.getAttribute('telegram') || '';
    const telegramUrl = this.getAttribute('telegram-url') || '';
    const email = this.getAttribute('email') || '';
    const legal = this.getAttribute('legal') || '';
    const copyright = this.getAttribute('copyright') || '';

    const contact = (label, value, href, external = false) => value ? `
      <a class="contact" href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>
        <span>${label}</span>
        <strong>${value}</strong>
      </a>` : '';

    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host {
          display:block;
          color:#d7d7d7;
          background:#050505;
          font-family:Arial, Helvetica, sans-serif;
        }
        *, *::before, *::after { box-sizing:border-box; }
        .footer {
          position:relative;
          min-height:260px;
          overflow:hidden;
          background:#050505;
        }
        .brand {
          position:absolute;
          z-index:0;
          top:0;
          bottom:0;
          display:flex;
          align-items:stretch;
        }
        .footer.left .brand { left:0; justify-content:flex-start; }
        .footer.right .brand { right:0; justify-content:flex-end; }
        .brand slot { display:contents; }
        .brand svg,
        .brand ::slotted(*) {
          display:block;
          width:auto;
          height:100%;
          max-width:none;
          flex:none;
          object-fit:contain;
        }
        .info {
          position:relative;
          z-index:1;
          width:min(44%, 560px);
          min-width:0;
          padding:clamp(36px, 5vw, 72px);
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:flex-start;
          gap:clamp(28px, 5vh, 48px);
        }
        .footer.left .info { margin-left:auto; }
        .footer.right .info { margin-right:auto; }
        .contacts { display:flex; flex-direction:column; gap:16px; }
        .heading {
          margin:0 0 4px;
          color:#5a5a5a;
          font-size:11px;
          font-weight:700;
          letter-spacing:.28em;
          text-transform:uppercase;
        }
        .contact {
          display:flex;
          flex-direction:column;
          gap:4px;
          color:#b8b8b8;
          text-decoration:none;
          transition:color .25s ease, transform .25s ease;
        }
        .contact span {
          color:#555;
          font-size:10px;
          font-weight:700;
          letter-spacing:.18em;
          text-transform:uppercase;
        }
        .contact strong {
          color:#d7d7d7;
          font-size:clamp(14px, 1.4vw, 18px);
          overflow-wrap:anywhere;
        }
        .contact:hover { color:#fff; transform:translateX(3px); }
        .bottom {
          display:flex;
          flex-direction:column;
          gap:10px;
          color:#5a5a5a;
          font-size:12px;
          line-height:1.45;
        }
        .bottom:empty { display:none; }
        .extra:empty { display:none; }
        ::slotted([slot="extra"]) { color:inherit; }
        @media (max-width:620px) {
          .footer {
            min-height:560px;
            display:grid;
            grid-template-rows:260px auto;
          }
          .brand {
            position:relative;
            grid-row:1;
          }
          .footer.left .brand { justify-content:flex-start; }
          .footer.right .brand { justify-content:flex-end; }
          .info {
            grid-row:2;
            width:100%;
            margin:0 !important;
            padding:32px 28px 40px;
            justify-content:flex-start;
            gap:26px;
          }
        }
      </style>
      <footer class="footer ${resolvedSide === 'left' ? 'left' : 'right'}">
        <div class="brand" aria-label="Amoboba">
          <slot name="logo">
            <svg viewBox="188 353 937 537" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill-rule="evenodd" fill="#fff" d="M391,353 L507,353 L309,890 L188,890 Z M557,353 L672,353 L474,890 L360,890 Z M723,353 L879,353 L1125,890 L521,890 Z M803,473 L884,656 L731,656 Z M689,777 L934,777 L984,890 L646,890 Z"/>
            </svg>
          </slot>
        </div>
        <div class="info">
          <div class="contacts">
            <p class="heading">Контакты</p>
            ${contact('Telegram', telegram, telegramUrl || `https://t.me/${telegram.replace(/^@/, '')}`, true)}
            ${contact('Почта', email, `mailto:${email}`)}
          </div>
          <div class="bottom">
            ${legal ? `<span>${legal}</span>` : ''}
            ${copyright ? `<span>${copyright}</span>` : ''}
            <div class="extra"><slot name="extra"></slot></div>
          </div>
        </div>
      </footer>
    `;
  }
}

customElements.define('amoboba-footer', AmobobaFooter);
