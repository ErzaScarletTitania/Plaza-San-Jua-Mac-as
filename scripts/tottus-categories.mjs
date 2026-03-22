export function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const allowedTopLevelCategoryData = [
  ["CATG16066", "Abarrotes", "https://www.tottus.com.pe/tottus-pe/lista/CATG16066/Abarrotes"],
  ["CATG16065", "Desayunos", "https://www.tottus.com.pe/tottus-pe/lista/CATG16065/Desayunos"],
  ["CATG16061", "Lácteos y Quesos", "https://www.tottus.com.pe/tottus-pe/lista/CATG16061/Lacteos"],
  ["CATG16060", "Huevos y Fiambres", "https://www.tottus.com.pe/tottus-pe/lista/CATG16060/Huevos-y-Fiambres"],
  ["CATG16062", "Congelados", "https://www.tottus.com.pe/tottus-pe/lista/CATG16062/Productos-Congelados"],
  ["CATG16076", "Carnes", "https://www.tottus.com.pe/tottus-pe/lista/CATG16076/Carnes"],
  ["CATG16074", "Pescados y Mariscos", "https://www.tottus.com.pe/tottus-pe/lista/CATG16074/Pescados-y-Mariscos"],
  ["CATG16050", "Frutas y Verduras", "https://www.tottus.com.pe/tottus-pe/lista/CATG16050/Frutas-y-Verduras"],
  ["CATG16071", "Panadería y Pastelería", "https://www.tottus.com.pe/tottus-pe/lista/CATG16071/Panaderia"],
  ["CATG16059", "Dulces y Galletas", "https://www.tottus.com.pe/tottus-pe/lista/CATG16059/Confiteria"],
  ["CATG16056", "Repostería", "https://www.tottus.com.pe/tottus-pe/lista/CATG16056/Reposteria"],
  ["CATG16064", "Platos Preparados", "https://www.tottus.com.pe/tottus-pe/lista/CATG16064/Platos-Preparados"],
  ["CATG16081", "Mundo Parrillero", "https://www.tottus.com.pe/tottus-pe/lista/CATG16081/Parrilla"],
  ["CATG16058", "Snack y Frutos Secos", "https://www.tottus.com.pe/tottus-pe/lista/CATG16058/Snacks"],
  ["CATG16070", "Cervezas", "https://www.tottus.com.pe/tottus-pe/lista/CATG16070/Cervezas"],
  ["CATG16069", "Bebidas Alcohólicas", "https://www.tottus.com.pe/tottus-pe/lista/CATG16069/Bebidas-Alcoholicas"],
  ["CATG16068", "Gaseosas Aguas y Jugos", "https://www.tottus.com.pe/tottus-pe/lista/CATG16068/Bebidas"],
  ["CATG44261", "Cuidado Capilar", "https://www.tottus.com.pe/tottus-pe/lista/CATG44261/Cuidado-Capilar"],
  ["CATG16072", "Cuidado Personal", "https://www.tottus.com.pe/tottus-pe/lista/CATG16072/Cuidado-Personal"],
  ["CATG16073", "Bebés y Niños", "https://www.tottus.com.pe/tottus-pe/lista/CATG16073/Mundo-Bebes"],
  ["CATG16057", "Belleza", "https://www.tottus.com.pe/tottus-pe/lista/CATG16057/Belleza"],
  ["CATG16051", "Limpieza", "https://www.tottus.com.pe/tottus-pe/lista/CATG16051/Limpieza"],
  ["CATG48300", "Vestuario", "https://www.tottus.com.pe/tottus-pe/lista/CATG48300/Vestuario"],
  ["CATG48296", "Muebles", "https://www.tottus.com.pe/tottus-pe/lista/CATG48296/Muebles"],
  ["CATG48294", "Dormitorio", "https://www.tottus.com.pe/tottus-pe/lista/CATG48294/Dormitorio"],
  ["CATG48295", "Menaje y Organización", "https://www.tottus.com.pe/tottus-pe/lista/CATG48295/Menaje-y-Organizacion"],
  ["CATG48299", "Bazar", "https://www.tottus.com.pe/tottus-pe/lista/CATG48299/Bazar"],
  ["CATG48297", "Juguetería", "https://www.tottus.com.pe/tottus-pe/lista/CATG48297/Jugueteria"],
  ["CATG48298", "Deportes y Aire Libre", "https://www.tottus.com.pe/tottus-pe/lista/CATG48298/Deportes-y-Aire-Libre"],
  ["CATG16055", "Mundo Mascotas", "https://www.tottus.com.pe/tottus-pe/lista/CATG16055/Mundo-Mascotas"],
];

export const allowedTopLevelCategories = allowedTopLevelCategoryData.map(
  ([id, name, href]) => ({
    id,
    name,
    href,
    slug: slugify(name),
  }),
);

const blockedCategoryKeywords = [
  "tecnologia",
  "electrohogar",
  "electronica",
  "pc",
  "computo",
  "computacion",
  "laptop",
  "tablet",
  "impresora",
  "televisor",
  "tv",
  "gaming",
  "audio",
  "celular",
  "smartwatch",
  "monitor",
];

export function isBlockedCategoryName(name) {
  const normalized = slugify(name);
  return blockedCategoryKeywords.some((keyword) => normalized.includes(keyword));
}

export function isAllowedTopLevelCategoryName(name) {
  const normalized = slugify(name);
  return allowedTopLevelCategories.some((category) => category.slug === normalized);
}
