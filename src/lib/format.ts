export const taka = (n: number) => `৳${n.toLocaleString("en-BD")}`;

export const lowestPrice = (options: { price: number }[]) => Math.min(...options.map((o) => o.price));
