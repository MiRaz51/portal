const USER_STORAGE_KEY = 'github_user';
const USAGE_STORAGE_KEY = 'project_usage';

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

  const savedUser = localStorage.getItem(USER_STORAGE_KEY) || 'MiRaz51';
  if (input) {
    input.value = savedUser;
  }

  const applyProfileLinks = (user) => {
    if (linkGithub) linkGithub.href = `https://github.com/${user}`;
    if (linkVercel) linkVercel.href = 'https://vercel.com';
    if (linkZeabur) linkZeabur.href = 'https://zeabur.com';
    if (linkLocal) {
      const host = window.location.hostname || 'localhost';
      linkLocal.href = `http://${host}:8000/`;
    }
  };

  applyProfileLinks(savedUser);
  loadProjects(savedUser);

  if (button && input) {
    const triggerLoad = () => {
      const value = input.value.trim();
      if (!value) return;
      localStorage.setItem(USER_STORAGE_KEY, value);
      applyProfileLinks(value);
      loadProjects(value);
    };

    button.addEventListener('click', triggerLoad);
    input.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        triggerLoad();
      }
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

  const link = target.closest('a.open-project');
  if (!link) return;

  const usageKey = link.getAttribute('data-usage-key');
  if (!usageKey) return;

  const usageMap = getUsageMap();
  usageMap[usageKey] = (usageMap[usageKey] || 0) + 1;
  saveUsageMap(usageMap);
});
