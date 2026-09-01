"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, createSession, destroySession, isAuthenticated } from "@/lib/auth";
import {
  addSource,
  deleteArticle,
  removeSource,
  setStatus,
  toggleSource,
  updateArticle,
} from "@/lib/repo";
import { runIngest } from "@/lib/ingest";
import { normalizeCategory } from "@/lib/categories";

async function guard() {
  if (!(await isAuthenticated())) redirect("/admin/login");
}

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get("password") || "");
  if (!password || !checkPassword(password)) {
    return "Contrasena incorrecta.";
  }
  await createSession();
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

export async function saveArticleAction(formData: FormData) {
  await guard();
  const id = Number(formData.get("id"));
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  await updateArticle(id, {
    title: String(formData.get("title") || "").trim(),
    dek: String(formData.get("dek") || "").trim(),
    body_md: String(formData.get("body_md") || "").trim(),
    tags,
    category: normalizeCategory(formData.get("category")),
    seo_title: String(formData.get("seo_title") || "").trim(),
    seo_description: String(formData.get("seo_description") || "").trim(),
    image_url: String(formData.get("image_url") || "").trim() || null,
  });

  const publish = formData.get("publish") === "1";
  if (publish) await setStatus(id, "published");

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(publish ? "/admin?ok=publicado" : `/admin/articulo/${id}?ok=guardado`);
}

export async function setStatusAction(formData: FormData) {
  await guard();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as "draft" | "published" | "rejected";
  await setStatus(id, status);
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function deleteArticleAction(formData: FormData) {
  await guard();
  await deleteArticle(Number(formData.get("id")));
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?ok=eliminado");
}

export async function ingestAction() {
  await guard();
  const report = await runIngest();
  revalidatePath("/");
  revalidatePath("/admin");
  redirect(
    `/admin?ok=${encodeURIComponent(
      `Ingesta: ${report.created} nuevos (${report.published} publicados automaticamente), ` +
        `${report.duplicates} repetidos entre medios, ${report.skipped} ya conocidos, ${report.failed} fallos`
    )}`
  );
}

export async function addSourceAction(formData: FormData) {
  await guard();
  await addSource(
    String(formData.get("name") || "").trim(),
    String(formData.get("feed_url") || "").trim(),
    String(formData.get("site_url") || "").trim(),
    String(formData.get("lang") || "en").trim()
  );
  revalidatePath("/admin/fuentes");
}

export async function toggleSourceAction(formData: FormData) {
  await guard();
  await toggleSource(Number(formData.get("id")));
  revalidatePath("/admin/fuentes");
}

export async function removeSourceAction(formData: FormData) {
  await guard();
  await removeSource(Number(formData.get("id")));
  revalidatePath("/admin/fuentes");
}
