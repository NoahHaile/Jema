/**
 * test:split — offline proof of the cost-split math. No secrets, no I/O.
 * Asserts perPerson rounding (incl. non-divisible) and collection over/under.
 */
import type { Payment } from "./receipts/store.js";
import { perPerson, collection } from "./cost/split.js";

function payment(amount: number | null): Payment {
  return {
    userId: Math.random(),
    name: "x",
    amount,
    currency: "birr",
    reference: null,
    receiptDate: null,
    recordedAt: "",
    weekKey: "w",
  };
}

console.log("=== perPerson ===");
const cases: [number, number, number | null][] = [
  [1200, 6, 200], // even
  [1200, 0, null], // nobody in -> null (no divide by zero)
  [1200, 7, 172], // 1200/7 = 171.43 -> ceil 172
  [1200, 5, 240], // even
  [1200, 8, 150], // even
  [1200, 9, 134], // 133.33 -> 134
  [1000, 3, 334], // 333.33 -> 334
];
for (const [total, n, expected] of cases) {
  const got = perPerson(total, n);
  console.log(`perPerson(${total}, ${n}) = ${got} (expected ${expected})`);
  if (got !== expected) throw new Error(`perPerson(${total}, ${n}) expected ${expected}, got ${got}`);
}

console.log("\n=== collection ===");
// Under: 800 of 1200.
const under = collection(1200, [payment(200), payment(200), payment(400)]);
console.log("under:", JSON.stringify(under));
if (under.collected !== 800 || under.remaining !== 400 || under.over !== 0 || under.paidCount !== 3) {
  throw new Error("under-collection assertion failed");
}

// Exact: 1200 of 1200.
const exact = collection(1200, [payment(600), payment(600)]);
console.log("exact:", JSON.stringify(exact));
if (exact.collected !== 1200 || exact.remaining !== 0 || exact.over !== 0) {
  throw new Error("exact-collection assertion failed");
}

// Over: 1400 of 1200.
const over = collection(1200, [payment(800), payment(600)]);
console.log("over:", JSON.stringify(over));
if (over.collected !== 1400 || over.remaining !== 0 || over.over !== 200) {
  throw new Error("over-collection assertion failed");
}

// Null amounts count as 0.
const withNulls = collection(1200, [payment(200), payment(null)]);
console.log("withNulls:", JSON.stringify(withNulls));
if (withNulls.collected !== 200 || withNulls.paidCount !== 2) {
  throw new Error("null-amount assertion failed");
}

console.log("\nAll split assertions passed ✅");
