import { env } from "../env";

export type Repo = {
  fullName: string;
  url: string;
  description: string;
  stars: number;
  starsPerDay: number;
  language: string | null;
  topics: string[];
  createdAt: Date;
  owner: string;
};

type ApiRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  topics?: string[];
  created_at: string;
  owner: { login: string };
};

function headers() {
  const h: Record<string, string> = {
    "user-agent": `${env.siteName}/1.0 (+${env.siteUrl})`,
    accept: "application/vnd.github+json",
  };
  // Sin token son 60 peticiones por hora; con el, 5000.
  if (env.githubToken) h.authorization = `Bearer ${env.githubToken}`;
  return h;
}

/**
 * Repositorios jovenes que estan acumulando estrellas muy rapido.
 *
 * GitHub no publica la serie historica de estrellas, asi que el crecimiento se
 * aproxima con estrellas por dia desde su creacion: un repo de dos semanas con
 * 5.000 estrellas esta creciendo de forma explosiva, uno de cinco anos con las
 * mismas no.
 */
export async function trendingRepos(opts: {
  dias?: number;
  minEstrellas?: number;
  limite?: number;
} = {}): Promise<Repo[]> {
  const dias = opts.dias ?? 21;
  const minEstrellas = opts.minEstrellas ?? 300;
  const limite = opts.limite ?? 10;

  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
  const q = encodeURIComponent(`created:>${desde} stars:>${minEstrellas}`);
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${limite}`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const cuerpo = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${cuerpo.slice(0, 160)}`);
  }

  const data = (await res.json()) as { items?: ApiRepo[] };
  return (data.items ?? []).map((r) => {
    const creado = new Date(r.created_at);
    const edadDias = Math.max(1, (Date.now() - creado.getTime()) / 86_400_000);
    return {
      fullName: r.full_name,
      url: r.html_url,
      description: r.description ?? "",
      stars: r.stargazers_count,
      starsPerDay: Math.round(r.stargazers_count / edadDias),
      language: r.language,
      topics: r.topics ?? [],
      createdAt: creado,
      owner: r.owner.login,
    };
  });
}

/** Primeros parrafos del README, que es donde el proyecto se explica. */
export async function readme(fullName: string): Promise<string> {
  try {
    const res = await fetch(`https://api.github.com/repos/${fullName}/readme`, {
      headers: { ...headers(), accept: "application/vnd.github.raw" },
    });
    if (!res.ok) return "";
    const texto = await res.text();
    return texto
      .replace(/<[^>]+>/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#*_>`|-]{2,}/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3500);
  } catch {
    return "";
  }
}

/** Material para el reescritor: datos duros mas la explicacion del proyecto. */
export function repoContent(repo: Repo, readmeText: string): string {
  const edadDias = Math.round((Date.now() - repo.createdAt.getTime()) / 86_400_000);
  return [
    `Repositorio de GitHub: ${repo.fullName}`,
    `Autor: ${repo.owner}`,
    `Descripcion oficial: ${repo.description || "(sin descripcion)"}`,
    `Estrellas: ${repo.stars.toLocaleString("es-ES")}`,
    `Creado hace ${edadDias} dias, con un ritmo medio de ${repo.starsPerDay} estrellas al dia.`,
    repo.language ? `Lenguaje principal: ${repo.language}` : "",
    repo.topics.length ? `Temas: ${repo.topics.join(", ")}` : "",
    "",
    "Contenido del README:",
    readmeText || "(el repositorio no tiene README legible)",
  ]
    .filter(Boolean)
    .join("\n");
}
