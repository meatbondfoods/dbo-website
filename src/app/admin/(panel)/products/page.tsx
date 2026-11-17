import { getRepositories } from "@/lib/repositories";
import { getAdminState } from "@/lib/content/store";
import { ProductDisplayEditor } from "../_components/ProductDisplayEditor";

export const dynamic = "force-dynamic";

export default async function ProductsAdmin() {
  const { catalog } = getRepositories();
  const [products, categories] = await Promise.all([catalog.listProducts(), catalog.listCategories()]);
  const state = getAdminState("productDisplay");
  const rows = products.map((p) => ({ id: p.id, name: p.name, category: categories.find((c) => c.id === p.categoryId)?.name ?? "Uncategorised", availability: p.availability }));
  return (
    <div className="py-8">
      <h1 className="text-3xl">Product display</h1>
      <div className="mt-4"><ProductDisplayEditor key={`pd-v${state.version}`} products={rows} draft={state.draft} published={state.published} version={state.version} /></div>
    </div>
  );
}
