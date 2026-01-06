const USER_STORAGE_KEY = 'github_user';
const USAGE_STORAGE_KEY = 'project_usage';
const PORT_STORAGE_KEY = 'local_port';
const HOST_STORAGE_KEY = 'local_host';

function getUsageMap() {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveUsageMap(map) {
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    // ignorar errores de almacenamiento
  }
}

async function copyTextToClipboard(text) {
  if (!text) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // continuar con fallback
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch (e) {
    return false;
  }
}

async function loadProjects(githubUser) {
  const container = document.getElementById('projects-container');

  if (!githubUser) {
    container.innerHTML = '<p>Ingresa un usuario de GitHub para ver sus proyectos.</p>';
    return;
  }

  const apiUrl = `https://api.github.com/users/${githubUser}/repos`;

  try {
    container.innerHTML = '<p>Cargando proyectos...</p>';

    const res = await fetch(apiUrl);
    if (!res.ok) {
      throw new Error('No se pudieron cargar los repositorios');
    }

    const repos = await res.json();

    const usageMap = getUsageMap();

    // Usar únicamente el campo homepage como URL de despliegue
    const projects = repos
      .map(repo => {
        const hasHomepage = repo.homepage && repo.homepage.trim() !== '';
        const deployUrl = hasHomepage ? repo.homepage.trim() : null;
        const key = repo.full_name || repo.name;
        const usageCount = usageMap[key] || 0;
        return { ...repo, deployUrl, usageCount, usageKey: key };
      })
      // Mantener solo los que realmente tienen una URL de despliegue (homepage)
      .filter(repo => repo.deployUrl)
      // opcional: ocultar forks
      .filter(repo => !repo.fork)
      // ordenar: primero por uso (desc), luego por fecha de actualización
      .sort((a, b) => {
        if (b.usageCount !== a.usageCount) {
          return b.usageCount - a.usageCount;
        }
        return new Date(b.pushed_at) - new Date(a.pushed_at);
      });

    if (projects.length === 0) {
      container.innerHTML = '<p>No hay proyectos con publicación configurada en el campo "Homepage" de GitHub para este usuario.</p>';
      return;
    }

    container.innerHTML = '';

    projects.forEach(repo => {
      const card = document.createElement('div');
      card.className = 'card';

      const description = repo.description || 'Sin descripción.';

      const starsHtml = repo.stargazers_count > 0
        ? `<span>⭐ ${repo.stargazers_count}</span>`
        : '';

      const githubUrl = repo.html_url || `https://github.com/${repo.full_name || repo.name}`;

      card.innerHTML = `
        <div class="card-preview">
          <iframe
            src="${repo.deployUrl}"
            loading="lazy"
            referrerpolicy="no-referrer"
            sandbox="allow-same-origin allow-forms allow-pointer-lock allow-popups"
          ></iframe>
        </div>
        <div class="card-content">
          <h3>${repo.name}</h3>
          <p>${description}</p>
        </div>
        <div class="card-footer">
          ${starsHtml}
          <div class="card-footer-actions">
            <button
              class="button secondary copy-link"
              type="button"
              data-copy-url="${repo.deployUrl}"
            >
              Copiar link
            </button>
            <a
              class="button secondary"
              href="${githubUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              class="button open-project"
              href="${repo.deployUrl}"
              target="_blank"
              rel="noopener noreferrer"
              data-usage-key="${repo.usageKey}"
            >
              Abrir proyecto
            </a>
          </div>
        </div>
      `;

      container.appendChild(card);
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p>Ocurrió un error al cargar los proyectos.</p>';
  }
}

function initUserControl() {
  const input = document.getElementById('github-user-input');
  const button = document.getElementById('github-user-button');
  const linkGithub = document.getElementById('link-github');
  const linkVercel = document.getElementById('link-vercel');
  const linkZeabur = document.getElementById('link-zeabur');
  const linkLocal = document.getElementById('link-local');

  // Modal elements
  const portModal = document.getElementById('port-modal');
  const modalHostInput = document.getElementById('modal-host-input');
  const modalPortInput = document.getElementById('modal-port-input');
  const modalClose = document.getElementById('modal-close');
  const modalCancel = document.getElementById('modal-cancel');
  const modalSubmit = document.getElementById('modal-submit');
  const statusBadge = document.getElementById('server-status');

  let statusInterval = null;

  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function getLocalUrl(host, port) {
    const finalHost = host || (isMobile() ? window.location.hostname : 'localhost');
    return `http://${finalHost}:${port}/`;
  }

  function applyProfileLinks(user) {
    if (linkGithub) linkGithub.href = `https://github.com/${user}`;
    if (linkVercel) linkVercel.href = 'https://vercel.com';
    if (linkZeabur) linkZeabur.href = 'https://zeabur.com';
  }

  async function checkServerStatus(host, port) {
    if (!statusBadge) return;
    statusBadge.className = 'status-badge checking';
    statusBadge.textContent = 'Verificando...';
    if (modalSubmit) modalSubmit.disabled = true;
    try {
      const url = getLocalUrl(host, port);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      await fetch(url, { mode: 'no-cors', signal: controller.signal });
      clearTimeout(timeoutId);
      statusBadge.className = 'status-badge online';
      statusBadge.textContent = 'Servidor activo';
      if (modalSubmit) modalSubmit.disabled = false;
    } catch (e) {
      statusBadge.className = 'status-badge offline';
      statusBadge.textContent = 'Servidor no detectado';
      if (modalSubmit) modalSubmit.disabled = true;
    }
  }


  const savedUser = localStorage.getItem(USER_STORAGE_KEY) || 'MiRaz51';
  const savedPort = localStorage.getItem(PORT_STORAGE_KEY) || '8000';

  const defaultHost = isMobile() ? (window.location.hostname !== 'localhost' ? window.location.hostname : '') : 'localhost';
  const savedHost = localStorage.getItem(HOST_STORAGE_KEY) || defaultHost;

  if (input) input.value = savedUser;
  if (modalPortInput) modalPortInput.value = savedPort;
  if (modalHostInput) modalHostInput.value = savedHost;

  applyProfileLinks(savedUser);
  loadProjects(savedUser);

  // Modal logic
  const openModal = () => {
    if (portModal) {
      portModal.style.display = 'flex';
      const host = modalHostInput.value.trim();
      const port = modalPortInput.value.trim();
      checkServerStatus(host, port);
      if (statusInterval) clearInterval(statusInterval);
      statusInterval = setInterval(() => {
        checkServerStatus(modalHostInput.value.trim(), modalPortInput.value.trim());
      }, 5000);
    }
  };

  const closeModal = () => {
    if (portModal) {
      portModal.style.display = 'none';
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
      }
    }
  };

  const onInputChange = () => {
    const host = modalHostInput.value.trim();
    const port = modalPortInput.value.trim();
    checkServerStatus(host, port);
  };

  if (modalHostInput) modalHostInput.addEventListener('input', onInputChange);
  if (modalPortInput) modalPortInput.addEventListener('input', onInputChange);

  if (linkLocal) {
    linkLocal.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalCancel) modalCancel.addEventListener('click', closeModal);

  if (portModal) {
    portModal.addEventListener('click', (e) => {
      if (e.target === portModal) closeModal();
    });
  }

  if (modalSubmit) {
    modalSubmit.addEventListener('click', () => {
      const host = modalHostInput.value.trim();
      const port = modalPortInput.value.trim() || '8000';

      localStorage.setItem(HOST_STORAGE_KEY, host);
      localStorage.setItem(PORT_STORAGE_KEY, port);

      const url = getLocalUrl(host, port);
      window.open(url, '_blank');
      closeModal();
    });
  }

  if (button && input) {
    const triggerLoad = () => {
      const user = input.value.trim();
      if (!user) return;
      localStorage.setItem(USER_STORAGE_KEY, user);
      applyProfileLinks(user);
      loadProjects(user);
    };

    button.addEventListener('click', triggerLoad);
    input.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') triggerLoad();
    });
  }
}

// Como el script está al final del body, podemos inicializar directamente
initUserControl();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('Error al registrar el service worker:', error);
    });
  });
}

// Registrar uso cuando se hace clic en "Abrir proyecto"
document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const copyButton = target.closest('button.copy-link');
  if (copyButton instanceof HTMLButtonElement) {
    const url = copyButton.getAttribute('data-copy-url') || '';
    const originalText = copyButton.textContent || 'Copiar link';
    copyButton.disabled = true;
    copyTextToClipboard(url).then((ok) => {
      copyButton.textContent = ok ? 'Copiado' : 'No se pudo copiar';
      window.setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.disabled = false;
      }, 1200);
    });
    return;
  }

  const link = target.closest('a.open-project');
  if (!link) return;

  const usageKey = link.getAttribute('data-usage-key');
  if (!usageKey) return;

  const usageMap = getUsageMap();
  usageMap[usageKey] = (usageMap[usageKey] || 0) + 1;
  saveUsageMap(usageMap);
});
