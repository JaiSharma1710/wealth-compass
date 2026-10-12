// Shared by server and client: category catalogue plus keyword-based auto-categorisation,
// so entries saved with only a note ("cng", "grocery") still land in a sensible bucket.

export const EXPENSE_CATEGORIES = [
  { key: "food", label: "Food & Dining", keywords: ["lunch", "dinner", "breakfast", "swiggy", "zomato", "food", "snack", "tea", "chai", "coffee", "restaurant", "cafe", "golgappe", "pizza", "burger", "biryani", "sweets", "juice", "eat"] },
  { key: "groceries", label: "Groceries", keywords: ["grocery", "groceries", "blinkit", "zepto", "instamart", "bigbasket", "dmart", "vegetable", "veggies", "fruit", "milk", "ration", "kirana"] },
  { key: "transport", label: "Transport & Fuel", keywords: ["cng", "petrol", "diesel", "fuel", "parking", "uber", "ola", "rapido", "metro", "toll", "fastag", "cab", "auto", "bus", "service", "car wash", "puncture"] },
  { key: "bills", label: "Bills & Utilities", keywords: ["electricity", "bill", "wifi", "internet", "broadband", "recharge", "mobile", "phone", "gas", "water", "rent", "maintenance", "dth", "cylinder"] },
  { key: "shopping", label: "Shopping", keywords: ["amazon", "flipkart", "myntra", "ajio", "clothes", "shoes", "shopping", "meesho", "nykaa", "electronics"] },
  { key: "health", label: "Health & Fitness", keywords: ["medicine", "doctor", "hospital", "pharmacy", "chemist", "gym", "health", "clinic", "test", "lab"] },
  { key: "entertainment", label: "Entertainment", keywords: ["movie", "netflix", "prime", "hotstar", "spotify", "party", "game", "concert", "subscription", "youtube"] },
  { key: "travel", label: "Travel", keywords: ["flight", "train", "hotel", "trip", "travel", "irctc", "booking", "airbnb", "holiday"] },
  { key: "personal", label: "Personal Care", keywords: ["salon", "haircut", "barber", "spa", "grooming", "laundry", "dry clean"] },
  { key: "gifts", label: "Gifts & Donations", keywords: ["gift", "donation", "charity", "temple", "shagun"] },
  { key: "education", label: "Education", keywords: ["course", "book", "books", "fees", "tuition", "udemy", "class"] },
  { key: "emi", label: "EMI & Loans", keywords: ["emi", "loan", "credit card"] },
  { key: "other", label: "Other", keywords: [] },
] as const;

export const CREDIT_CATEGORIES = [
  { key: "income", label: "Income", keywords: ["salary", "bonus", "income", "freelance", "interest", "dividend"] },
  { key: "refund", label: "Refund / Cashback", keywords: ["refund", "cashback", "reversal", "return"] },
  { key: "reimbursement", label: "Reimbursement", keywords: ["reimburse", "reimbursement", "split", "paid back", "settle"] },
  { key: "other_credit", label: "Other Credit", keywords: [] },
] as const;

export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORIES)[number]["key"];
export type CreditCategoryKey = (typeof CREDIT_CATEGORIES)[number]["key"];
export type EntryCategoryKey = ExpenseCategoryKey | CreditCategoryKey;

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...CREDIT_CATEGORIES];

export function getCategoryLabel(key: string) {
  return ALL_CATEGORIES.find((category) => category.key === key)?.label || "Other";
}

export function isValidCategory(entryType: "expense" | "credit", key: string) {
  const list = entryType === "expense" ? EXPENSE_CATEGORIES : CREDIT_CATEGORIES;
  return list.some((category) => category.key === key);
}

export function inferCategory(entryType: "expense" | "credit", note: string): EntryCategoryKey {
  const text = ` ${note.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  const list = entryType === "expense" ? EXPENSE_CATEGORIES : CREDIT_CATEGORIES;

  for (const category of list) {
    if (category.keywords.some((keyword) => text.includes(` ${keyword} `) || text.includes(` ${keyword}s `))) {
      return category.key;
    }
  }

  return entryType === "expense" ? "other" : "other_credit";
}

/** Stored category wins; otherwise infer from the note. */
export function resolveCategory(entryType: "expense" | "credit", category: string | null | undefined, note: string) {
  return category && isValidCategory(entryType, category) ? (category as EntryCategoryKey) : inferCategory(entryType, note);
}
