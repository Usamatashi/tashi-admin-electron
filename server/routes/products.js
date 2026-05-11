import { Router } from "express";
import { fdb, nextId, toISOString } from "../lib/firebase.js";
import { uploadBase64ToStorage, deleteFromStorage } from "../lib/storage.js";
import { requireAdmin } from "../lib/auth.js";
import { pickFirst, toNumber } from "../lib/helpers.js";

const router = Router();

function normalizePublic(doc) {
  const data = doc.data() ?? {};
  const salesPrice = toNumber(pickFirst(data, ["salesPrice", "price", "sellingPrice", "unitPrice"]), 0);
  const websitePrice = data.websitePrice != null ? toNumber(data.websitePrice, null) : null;
  return {
    id: doc.id,
    name: pickFirst(data, ["name", "title", "productName"]) ?? "",
    salesPrice,
    websitePrice,
    displayPrice: websitePrice != null ? websitePrice : salesPrice,
    category: pickFirst(data, ["category", "type", "kind"]) ?? "other",
    productNumber: pickFirst(data, ["productNumber", "sku", "productCode", "code", "partNumber"]),
    vehicleManufacturer: pickFirst(data, ["vehicleManufacturer", "vehicle", "manufacturer", "make", "fitsVehicle"]),
    imageUrl: pickFirst(data, ["imageUrl", "image", "imageURL", "photoUrl", "thumbnail"]),
  };
}

router.get("/public", async (_req, res) => {
  try {
    const snap = await fdb.collection("products").get();
    res.json(snap.docs.map(normalizePublic).filter((p) => p.name));
  } catch (err) {
    console.error("Failed to fetch products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const snap = await fdb.collection("products").get();
    const rows = snap.docs.map((d) => {
      const p = d.data();
      return {
        id: p.id ?? Number(d.id),
        name: p.name ?? "",
        points: p.points ?? 0,
        salesPrice: p.salesPrice ?? 0,
        websitePrice: p.websitePrice != null ? Number(p.websitePrice) : null,
        category: p.category ?? "other",
        productNumber: p.productNumber ?? null,
        vehicleManufacturer: p.vehicleManufacturer ?? null,
        imageUrl: p.imageUrl ?? null,
        diagramUrl: p.diagramUrl ?? null,
        createdAt: toISOString(p.createdAt),
      };
    });
    rows.sort((a, b) => (Date.parse(b.createdAt || 0) || 0) - (Date.parse(a.createdAt || 0) || 0));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.post("/admin", requireAdmin, async (req, res) => {
  try {
    const { name, points, salesPrice, websitePrice, category, productNumber, vehicleManufacturer, imageBase64, diagramBase64 } = req.body;
    if (!name || points === undefined) return res.status(400).json({ error: "Name and points are required" });
    const id = await nextId("products");
    let imageUrl = null;
    let diagramUrl = null;
    if (imageBase64) imageUrl = await uploadBase64ToStorage(imageBase64, `products/${id}/image`);
    if (diagramBase64) diagramUrl = await uploadBase64ToStorage(diagramBase64, `products/${id}/diagram`);
    const cat = category || "other";
    const product = {
      id,
      name,
      points: Number(points),
      salesPrice: Number(salesPrice) || 0,
      websitePrice: websitePrice !== undefined && websitePrice !== "" && websitePrice !== null ? Number(websitePrice) : null,
      category: cat,
      productNumber: cat === "other" ? null : (productNumber ? String(productNumber).trim() : null),
      vehicleManufacturer: cat === "other" ? null : (vehicleManufacturer ? String(vehicleManufacturer).trim() : null),
      imageUrl,
      diagramUrl,
      createdAt: new Date(),
    };
    await fdb.collection("products").doc(String(id)).set(product);
    res.status(201).json({ ...product, createdAt: toISOString(product.createdAt) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid product id" });
    const { name, points, salesPrice, websitePrice, category, productNumber, vehicleManufacturer, imageBase64, diagramBase64 } = req.body;
    if (!name || points === undefined) return res.status(400).json({ error: "Name and points are required" });
    const ref = fdb.collection("products").doc(String(id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Product not found" });
    const cat = category || "other";
    const updateData = {
      name,
      points: Number(points),
      salesPrice: Number(salesPrice) || 0,
      websitePrice: websitePrice !== undefined && websitePrice !== "" && websitePrice !== null ? Number(websitePrice) : null,
      category: cat,
      productNumber: cat === "other" ? null : (productNumber ? String(productNumber).trim() : null),
      vehicleManufacturer: cat === "other" ? null : (vehicleManufacturer ? String(vehicleManufacturer).trim() : null),
    };
    if (imageBase64 !== undefined) {
      await deleteFromStorage(`products/${id}/image`);
      updateData.imageUrl = imageBase64 ? await uploadBase64ToStorage(imageBase64, `products/${id}/image`) : null;
    }
    if (diagramBase64 !== undefined) {
      await deleteFromStorage(`products/${id}/diagram`);
      updateData.diagramUrl = diagramBase64 ? await uploadBase64ToStorage(diagramBase64, `products/${id}/diagram`) : null;
    }
    await ref.update(updateData);
    const updated = { ...doc.data(), ...updateData };
    res.json({
      id: updated.id,
      name: updated.name,
      points: updated.points,
      salesPrice: updated.salesPrice,
      websitePrice: updated.websitePrice != null ? Number(updated.websitePrice) : null,
      category: updated.category,
      productNumber: updated.productNumber ?? null,
      vehicleManufacturer: updated.vehicleManufacturer ?? null,
      imageUrl: updated.imageUrl ?? null,
      diagramUrl: updated.diagramUrl ?? null,
      createdAt: toISOString(updated.createdAt),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid product id" });
    await deleteFromStorage(`products/${id}/image`);
    await deleteFromStorage(`products/${id}/diagram`);
    await fdb.collection("products").doc(String(id)).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
