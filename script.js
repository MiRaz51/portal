const GITHUB_USER = 'MiRaz51';
const API_URL = `https://api.github.com/users/${GITHUB_USER}/repos`;

async function loadProjects() {
  const container = document.getElementById('projects-container');

  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      throw new Error('No se pudieron cargar los repositorios');
    }

    const repos = await res.json();

    // Construir una URL de despliegue a partir de homepage o GitHub Pages
    const projects = repos
      .map(repo => {
        let deployUrl = null;

        if (repo.homepage && repo.homepage.trim() !== '') {
          deployUrl = repo.homepage.trim();
        } else if (repo.has_pages) {
          // URL estándar de GitHub Pages para repos de usuario
          deployUrl = `https://${GITHUB_USER}.github.io/${repo.name}/`;
        }

        return { ...repo, deployUrl };
      })
      // Mantener solo los que realmente tienen una URL de despliegue
      .filter(repo => repo.deployUrl)
      // opcional: ocultar forks
      .filter(repo => !repo.fork)
      // opcional: ordenar por fecha de actualización
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

    if (projects.length === 0) {
      container.innerHTML = '<p>No hay proyectos con publicación configurada (homepage o GitHub Pages).</p>';
      return;
    }

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

loadProjects();
