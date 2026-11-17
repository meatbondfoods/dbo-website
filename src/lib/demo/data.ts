import type { Category, Product, WeightOption } from "../domain/types";

// SAMPLE CONTENT: demo catalogue until the ERP catalogue is connected.
export const DEMO_CATEGORIES: Category[] = [
  { id: "cat-whole", slug: "whole-chicken", name: "Whole Chicken", description: "Whole birds, cleaned and ready to cook." },
  { id: "cat-cuts", slug: "chicken-cuts", name: "Chicken Cuts", description: "Breast, drumsticks and everyday cuts." },
  { id: "cat-processed", slug: "processed", name: "Processed Products", description: "Sausages and kebabs, ready to cook." },
  { id: "cat-other", slug: "other-meat", name: "Other Meat Products", description: "Beef and mutton for the family table." },
];

const opts = (base: number): WeightOption[] => [
  { id: "500g", label: "500 g", grams: 500, price: Math.round(base * 0.5) },
  { id: "1kg", label: "1 kg", grams: 1000, price: base },
  { id: "2kg", label: "2 kg", grams: 2000, price: Math.round(base * 1.95) },
];
const single = (grams: number, price: number): WeightOption[] => [{ id: `${grams}g`, label: `${grams} g`, grams, price }];
const img = (slug: string) => [`/products/${slug}-1.svg`, `/products/${slug}-2.svg`];

export const DEMO_PRODUCTS: Product[] = [
  { id: "p-001", slug: "whole-broiler-chicken", name: "Whole Broiler Chicken", categoryId: "cat-whole", description: "Fresh, skin-on whole broiler, cleaned and chilled. Sample product for the demo.", images: img("whole-broiler-chicken"), options: opts(320), availability: "in_stock", tags: ["bestseller"], rating: 4.8, reviewCount: 214, badge: "Best seller" },
  { id: "p-002", slug: "chicken-breast-boneless", name: "Chicken Breast, Boneless", categoryId: "cat-cuts", description: "Lean, trimmed boneless breast fillets. Sample product for the demo.", images: img("chicken-breast-boneless"), options: opts(480), availability: "in_stock", tags: ["bestseller"], rating: 4.7, reviewCount: 156 },
  { id: "p-003", slug: "chicken-drumsticks", name: "Chicken Drumsticks", categoryId: "cat-cuts", description: "Juicy drumsticks, ideal for roasting and grilling. Sample product for the demo.", images: img("chicken-drumsticks"), options: opts(390), availability: "low_stock", tags: [], rating: 4.6, reviewCount: 98 },
  { id: "p-004", slug: "beef-curry-cut", name: "Beef Curry Cut", categoryId: "cat-other", description: "Bone-in beef pieces cut for traditional curries. Sample product for the demo.", images: img("beef-curry-cut"), options: opts(850), availability: "in_stock", tags: ["bestseller"], rating: 4.9, reviewCount: 301, badge: "Best seller" },
  { id: "p-005", slug: "beef-mince", name: "Beef Mince", categoryId: "cat-other", description: "Freshly ground lean beef. Sample product for the demo.", images: img("beef-mince"), options: opts(820), availability: "in_stock", tags: [], rating: 4.5, reviewCount: 74 },
  { id: "p-006", slug: "mutton-leg-cut", name: "Mutton Leg Cut", categoryId: "cat-other", description: "Tender leg pieces, perfect for slow cooking. Sample product for the demo.", images: img("mutton-leg-cut"), options: opts(1150), availability: "in_stock", tags: [], rating: 4.7, reviewCount: 61 },
  { id: "p-007", slug: "chicken-sausage", name: "Chicken Sausage", categoryId: "cat-processed", description: "Smoked chicken sausages, ready to cook. Sample product for the demo.", images: img("chicken-sausage"), options: single(500, 280), availability: "in_stock", tags: ["bestseller"], rating: 4.4, reviewCount: 39, badge: "New" },
  { id: "p-008", slug: "seekh-kebab", name: "Seekh Kebab", categoryId: "cat-processed", description: "Spiced minced-beef kebabs. Sample product for the demo.", images: img("seekh-kebab"), options: single(500, 420), availability: "out_of_stock", tags: [], rating: 4.6, reviewCount: 52 },
];
