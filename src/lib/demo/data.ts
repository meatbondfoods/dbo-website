import type { Category, Product, WeightOption } from "../domain/types";

export const DEMO_CATEGORIES: Category[] = [
  { id: "cat-chicken", slug: "chicken", name: "Fresh Chicken", description: "Whole birds and cuts, processed daily." },
  { id: "cat-beef", slug: "beef", name: "Beef", description: "Premium beef cuts and mince." },
  { id: "cat-mutton", slug: "mutton", name: "Mutton", description: "Tender, fresh mutton cuts." },
  { id: "cat-processed", slug: "processed", name: "Processed Foods", description: "Ready-to-cook sausages, nuggets and kebabs." },
];

const opts = (base: number): WeightOption[] => [
  { id: "500g", label: "500 g", grams: 500, price: Math.round(base * 0.5) },
  { id: "1kg", label: "1 kg", grams: 1000, price: base },
  { id: "2kg", label: "2 kg", grams: 2000, price: Math.round(base * 1.95) },
];
const single = (grams: number, price: number): WeightOption[] => [{ id: `${grams}g`, label: `${grams} g`, grams, price }];
const img = (slug: string) => [`/products/${slug}-1.svg`, `/products/${slug}-2.svg`];

export const DEMO_PRODUCTS: Product[] = [
  { id: "p-001", slug: "whole-broiler-chicken", name: "Whole Broiler Chicken", categoryId: "cat-chicken", description: "Fresh, skin-on whole broiler, cleaned and chilled.", images: img("whole-broiler-chicken"), options: opts(320), availability: "in_stock", tags: ["bestseller"], rating: 4.8, reviewCount: 214, badge: "Best Seller" },
  { id: "p-002", slug: "chicken-breast-boneless", name: "Chicken Breast, Boneless", categoryId: "cat-chicken", description: "Lean, trimmed boneless breast fillets.", images: img("chicken-breast-boneless"), options: opts(480), availability: "in_stock", tags: ["lean"], rating: 4.7, reviewCount: 156 },
  { id: "p-003", slug: "chicken-drumsticks", name: "Chicken Drumsticks", categoryId: "cat-chicken", description: "Juicy drumsticks, ideal for roasting and grilling.", images: img("chicken-drumsticks"), options: opts(390), availability: "low_stock", tags: [], rating: 4.6, reviewCount: 98 },
  { id: "p-004", slug: "beef-curry-cut", name: "Beef Curry Cut", categoryId: "cat-beef", description: "Bone-in beef pieces cut for traditional curries.", images: img("beef-curry-cut"), options: opts(850), availability: "in_stock", tags: ["bestseller"], rating: 4.9, reviewCount: 301, badge: "Best Seller" },
  { id: "p-005", slug: "beef-mince", name: "Beef Mince", categoryId: "cat-beef", description: "Freshly ground lean beef, no fillers.", images: img("beef-mince"), options: opts(820), availability: "in_stock", tags: [], rating: 4.5, reviewCount: 74 },
  { id: "p-006", slug: "mutton-leg-cut", name: "Mutton Leg Cut", categoryId: "cat-mutton", description: "Tender leg pieces, perfect for slow cooking.", images: img("mutton-leg-cut"), options: opts(1150), availability: "in_stock", tags: [], rating: 4.7, reviewCount: 61 },
  { id: "p-007", slug: "chicken-sausage", name: "Chicken Sausage", categoryId: "cat-processed", description: "Smoked chicken sausages, ready to cook.", images: img("chicken-sausage"), options: single(500, 280), availability: "in_stock", tags: ["new"], rating: 4.4, reviewCount: 39, badge: "New" },
  { id: "p-008", slug: "seekh-kebab", name: "Seekh Kebab", categoryId: "cat-processed", description: "Spiced minced-beef kebabs, frozen.", images: img("seekh-kebab"), options: single(500, 420), availability: "out_of_stock", tags: [], rating: 4.6, reviewCount: 52 },
];
