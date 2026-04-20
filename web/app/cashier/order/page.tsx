"use client";
import { Suspense } from "react";
import OrderPageInner from "./OrderPageInner";

export default function OrderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading...</div>}>
      <OrderPageInner />
    </Suspense>
  );
}