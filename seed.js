const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, required: true },
  hoverImage: { type: String },
  isBestSeller: { type: Boolean, default: false },
  isNewArrival: { type: Boolean, default: false },
  reviews: { type: Number, default: 0 },
  description: { type: String }
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const products = [
  // --- RINGS ---
  {
    name: "Eagle Adjustable Ring",
    slug: "eagle-adjustable-ring",
    price: 799,
    category: "Rings",
    image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: false,
    reviews: 142,
    description: "Handcrafted 925 sterling silver eagle motif with an adjustable band for a perfect fit."
  },
  {
    name: "Ocean Wave Band",
    slug: "ocean-wave-band",
    price: 899,
    category: "Rings",
    image: "https://images.unsplash.com/photo-1627225924765-552d49cf47ad?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: true,
    reviews: 89
  },
  {
    name: "Interlocking Silver Ring",
    slug: "interlocking-ring",
    price: 1399,
    category: "Rings",
    image: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    reviews: 52
  },
  {
    name: "Braided Silver Band",
    slug: "braided-band",
    price: 999,
    category: "Rings",
    image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    reviews: 44
  },
  {
    name: "Meteorite Texture Ring",
    slug: "meteorite-texture-ring",
    price: 1199,
    category: "Rings",
    image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    isNewArrival: true,
    reviews: 11
  },
  {
    name: "Industrial Bolt Ring",
    slug: "industrial-bolt-ring",
    price: 949,
    category: "Rings",
    image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    reviews: 7
  },
  {
    name: "Classic Signet Ring",
    slug: "classic-signet",
    price: 1599,
    category: "Rings",
    image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: true,
    reviews: 210
  },
  {
    name: "Minimalist Infinity Band",
    slug: "infinity-band",
    price: 699,
    category: "Rings",
    image: "https://images.unsplash.com/photo-1589128777073-263566ae5e4d?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    reviews: 33
  },

  // --- PENDANTS ---
  {
    name: "Double Layer Choker",
    slug: "layer-choker",
    price: 2199,
    category: "Pendants",
    image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: false,
    reviews: 112
  },
  {
    name: "Urban Industrial Chain",
    slug: "industrial-chain",
    price: 2499,
    category: "Pendants",
    image: "https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: true,
    reviews: 18
  },
  {
    name: "Lariat Anchor Chain",
    slug: "lariat-anchor-chain",
    price: 1899,
    category: "Pendants",
    image: "https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    reviews: 3
  },
  {
    name: "Astro Compass Pendant",
    slug: "compass-pendant",
    price: 1799,
    category: "Pendants",
    image: "https://images.unsplash.com/photo-1599643478518-17488fbbcd75?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: true,
    reviews: 94
  },
  {
    name: "Geometric Prism Charm",
    slug: "prism-pendant",
    price: 1299,
    category: "Pendants",
    image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    reviews: 22
  },

  // --- BRACELETS ---
  {
    name: "Snake Chain Anklet",
    slug: "snake-anklet",
    price: 749,
    category: "Bracelets",
    image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    reviews: 31
  },
  {
    name: "Heavy Link Curb Bracelet",
    slug: "curb-bracelet",
    price: 2899,
    category: "Bracelets",
    image: "https://images.unsplash.com/photo-1611955723041-94970f90240d?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: true,
    reviews: 56
  },
  {
    name: "Handmade Bamboo Cuff",
    slug: "bamboo-cuff",
    price: 1899,
    category: "Bracelets",
    image: "https://images.unsplash.com/photo-1573408301185-a1d31e66754a?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    isNewArrival: true,
    reviews: 12
  },

  // --- EARRINGS ---
  {
    name: "Hammered Silver Hoops",
    slug: "hammered-silver-hoops",
    price: 799,
    category: "Earrings",
    image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    reviews: 19
  },
  {
    name: "Cyberpunk Studs",
    slug: "cyber-studs",
    price: 499,
    category: "Earrings",
    image: "https://images.unsplash.com/photo-1588444839138-042230498c2b?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: true,
    reviews: 204
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Miso Studio DB Connected for Fresh Seed...");
    await Product.deleteMany();
    console.log("All previous items removed.");
    await Product.insertMany(products);
    console.log(`${products.length} Premium Silver Products Seeded Successfully!`);
    process.exit(0);
  } catch (error) {
    console.error("Seeding Error:", error.message);
    process.exit(1);
  }
};

seedDatabase();