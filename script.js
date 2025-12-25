const USER_STORAGE_KEY = 'github_user';

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

    // Usar únicamente el campo homepage como URL de despliegue
    const projects = repos
      .map(repo => {
        const hasHomepage = repo.homepage && repo.homepage.trim() !== '';
        const deployUrl = hasHomepage ? repo.homepage.trim() : null;
        return { ...repo, deployUrl };
      })
      // Mantener solo los que realmente tienen una URL de despliegue (homepage)
      .filter(repo => repo.deployUrl)
      // opcional: ocultar forks
      .filter(repo => !repo.fork)
      // opcional: ordenar por fecha de actualización
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

    if (projects.length === 0) {
      container.innerHTML = '<p>No hay proyectos con publicación configurada en el campo "Homepage" de GitHub para este usuario.</p>';
      return;
    }

    container.innerHTML = '';

    projects.forEach(repo => {
      const card = document.createElement('div');
      card.className = 'card';

      const description = repo.description || 'Sin descripción.';

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
          <span>⭐ ${repo.stargazers_count}</span>
          <a
            class="button"
            href="${repo.deployUrl}"
            target="_blank"
            rel="noopener noreferrer"
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

  const savedUser = localStorage.getItem(USER_STORAGE_KEY) || 'MiRaz51';
  if (input) {
    input.value = savedUser;
  }

  const applyProfileLinks = (user) => {
    if (linkGithub) linkGithub.href = `https://github.com/${user}`;
    if (linkVercel) linkVercel.href = 'https://vercel.com';
    if (linkZeabur) linkZeabur.href = 'https://zeabur.com';
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
