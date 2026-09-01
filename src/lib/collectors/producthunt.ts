import { env } from "../env";

/**
 * Product Hunt no sirve para esto por RSS: el feed publico solo trae el nombre
 * del producto y un "Discussion | Link" de 17 caracteres, y las fichas
 * responden 403 a cualquier peticion que no venga de un navegador real. Con
 * eso no se puede escribir nada sin inventar.
 *
 * La API oficial si da nombre, lema, descripcion y votos.
 *
 * En https://www.producthunt.com/v2/oauth/applications se registra una
 * aplicacion y se obtienen API Key y API Secret. Con esas dos credenciales se
 * pide un token al vuelo (flujo client_credentials), que es lo que hace este
 * modulo. Esa misma pantalla ofrece ademas un "Developer Token" ya listo: si
 * se prefiere, basta con ponerlo en PRODUCTHUNT_TOKEN y saltarse el paso.
 *
 * En vez de un articulo por producto —que serian cincuenta piezas diarias de
 * dos parrafos— se genera un resumen diario con los lanzamientos destacados,
 * que es la forma periodistica que pide este material.
 */

export type Product = {
  name: string;
  tagline: string;
  description: string;
  votes: number;
  url: string;
  topics: string[];
};

const API = "https://api.producthunt.com/v2/api/graphql";
const OAUTH = "https://api.producthunt.com/v2/oauth/token";

/** Token en memoria, para no pedir uno nuevo en cada ingesta. */
let cache: { token: string; expira: number } | null = null;

/**
 * Devuelve un bearer valido. Prioriza el developer token si esta configurado;
 * si no, intercambia API Key y Secret por uno (grant client_credentials, que
 * da acceso de solo lectura a los datos publicos).
 */
export async function obtenerToken(forzar = false): Promise<string> {
  if (env.productHuntToken) return env.productHuntToken;

  if (!forzar && cache && cache.expira > Date.now()) return cache.token;

  const { productHuntClientId: id, productHuntClientSecret: secreto } = env;
  if (!id || !secreto) {
    throw new Error(
      "Faltan credenciales de Product Hunt. Registra una aplicacion en " +
        "https://www.producthunt.com/v2/oauth/applications y pon su API Key y " +
        "API Secret en PRODUCTHUNT_CLIENT_ID y PRODUCTHUNT_CLIENT_SECRET " +
        "(o pega su Developer Token en PRODUCTHUNT_TOKEN)."
    );
  }

  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: id,
      client_secret: secreto,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const cuerpo = await res.text().catch(() => "");
    throw new Error(`Product Hunt OAuth ${res.status}: ${cuerpo.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Product Hunt no devolvio access_token");

  // La API no siempre informa de la caducidad; asumimos una hora y renovamos
  // igualmente en cuanto una peticion responda 401.
  const segundos = json.expires_in ?? 3600;
  cache = { token: json.access_token, expira: Date.now() + segundos * 900 };
  return cache.token;
}

const CONSULTA = `
query LanzamientosRecientes($desde: DateTime!) {
  posts(order: VOTES, postedAfter: $desde, first: 10) {
    edges {
      node {
        name
        tagline
        description
        votesCount
        url
        topics(first: 4) { edges { node { name } } }
      }
    }
  }
}`;

type Respuesta = {
  data?: {
    posts?: {
      edges: {
        node: {
          name: string;
          tagline: string;
          description: string | null;
          votesCount: number;
          url: string;
          topics: { edges: { node: { name: string } }[] };
        };
      }[];
    };
  };
  errors?: { message: string }[];
};

export async function lanzamientos(horas = 24): Promise<Product[]> {
  const desde = new Date(Date.now() - horas * 3_600_000).toISOString();

  const consultar = async (token: string) =>
    fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: CONSULTA, variables: { desde } }),
    });

  let res = await consultar(await obtenerToken());

  // Un token cacheado puede haber caducado antes de tiempo: se pide otro y
  // se reintenta una sola vez.
  if (res.status === 401 && !env.productHuntToken) {
    res = await consultar(await obtenerToken(true));
  }

  if (!res.ok) {
    const cuerpo = await res.text().catch(() => "");
    throw new Error(`Product Hunt ${res.status}: ${cuerpo.slice(0, 160)}`);
  }

  const json = (await res.json()) as Respuesta;
  if (json.errors?.length) {
    throw new Error(`Product Hunt: ${json.errors.map((e) => e.message).join("; ")}`);
  }

  return (json.data?.posts?.edges ?? []).map((e) => ({
    name: e.node.name,
    tagline: e.node.tagline,
    description: e.node.description ?? "",
    votes: e.node.votesCount,
    url: e.node.url,
    topics: e.node.topics.edges.map((t) => t.node.name),
  }));
}

/** Material para el reescritor: la tanda del dia, ordenada por votos. */
export function digestContent(productos: Product[]): string {
  const lineas = productos.map((p, i) => {
    const partes = [
      `${i + 1}. ${p.name} — ${p.tagline}`,
      p.description ? `   Descripcion: ${p.description.slice(0, 400)}` : "",
      p.topics.length ? `   Categorias: ${p.topics.join(", ")}` : "",
      `   Votos: ${p.votes}`,
      `   Enlace: ${p.url}`,
    ];
    return partes.filter(Boolean).join("\n");
  });

  return [
    "Lanzamientos destacados de las ultimas 24 horas en Product Hunt,",
    "ordenados por votos de la comunidad.",
    "",
    ...lineas,
  ].join("\n");
}
