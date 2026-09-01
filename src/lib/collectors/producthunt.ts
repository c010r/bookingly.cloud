import { env } from "../env";

/**
 * Product Hunt no sirve para esto por RSS: el feed publico solo trae el nombre
 * del producto y un "Discussion | Link" de 17 caracteres, y las fichas
 * responden 403 a cualquier peticion que no venga de un navegador real. Con
 * eso no se puede escribir nada sin inventar.
 *
 * La API oficial si da nombre, lema, descripcion y votos. Necesita un token de
 * desarrollador (gratuito) en https://www.producthunt.com/v2/oauth/applications
 * puesto en PRODUCTHUNT_TOKEN.
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
  if (!env.productHuntToken) {
    throw new Error(
      "Falta PRODUCTHUNT_TOKEN. Crea un token en " +
        "https://www.producthunt.com/v2/oauth/applications y ponlo en el .env."
    );
  }

  const desde = new Date(Date.now() - horas * 3_600_000).toISOString();

  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${env.productHuntToken}`,
    },
    body: JSON.stringify({ query: CONSULTA, variables: { desde } }),
  });

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
