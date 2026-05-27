import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DeliveryPage } from "./pages/DeliveryPage";
import { ProductDeliveryTab } from "./pages/ProductDeliveryTab";
import { ProductDeliveryBadge } from "./pages/ProductDeliveryBadge";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DeliveryPage />} />
        <Route path="/product-delivery" element={<ProductDeliveryTab />} />
        <Route path="/product-delivery-badge" element={<ProductDeliveryBadge />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
