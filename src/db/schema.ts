import {
  pgTable, serial, text, integer, numeric, date, timestamp, boolean, uniqueIndex, index
} from "drizzle-orm/pg-core";

// ---------- tenancy ----------
export const households = pgTable("households", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("PKR"),
  monthlyBudget: numeric("monthly_budget", { precision: 14, scale: 2 }).notNull().default("0"),
  incentivePct: integer("incentive_pct").notNull().default(10),
  lastRevaluedAt: date("last_revalued_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  householdId: integer("household_id").notNull().references(() => households.id),
  role: text("role").notNull().default("member") // owner | member
}, (t) => ({ uniq: uniqueIndex("memberships_user_household").on(t.userId, t.householdId) }));

// ---------- reference data (all per-household) ----------
export const persons = pgTable("persons", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  name: text("name").notNull()
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("bank"), // bank | cash
  isArchived: boolean("is_archived").notNull().default(false),
  /**
   * What sat in the account the day the household started keeping this book.
   *
   * A ledger records movement, not position — it cannot know what was already
   * there before the first import. With this one figure the live balance
   * becomes derivable: opening + income − expense ± transfers. Null means the
   * balance is unknown, which is shown as such rather than as zero.
   */
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }),
  /** The date `openingBalance` was true; movement is counted from here. */
  openingDate: date("opening_date")
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  passthroughDefault: boolean("passthrough_default").notNull().default(false),
  /**
   * Categories are never deleted once transactions point at them — archiving
   * hides one from the pickers while its history stays readable. Mirrors
   * `accounts.isArchived`.
   */
  isArchived: boolean("is_archived").notNull().default(false)
});

// ---------- ledger ----------
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  // expense | income | transfer (transfer: money moves accountId -> counterAccountId)
  type: text("type").notNull(),
  counterAccountId: integer("counter_account_id").references(() => accounts.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  txDate: date("tx_date").notNull(),
  description: text("description").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id),
  personId: integer("person_id").references(() => persons.id), // null = whole household
  isAbnormal: boolean("is_abnormal").notNull().default(false),
  isPassthrough: boolean("is_passthrough").notNull().default(false),
  needsReview: boolean("needs_review").notNull().default(false),
  // Tooba flags a transaction with a question; Abdullah answers it in-app.
  reviewNote: text("review_note"),
  reviewAskedBy: integer("review_asked_by").references(() => users.id),
  reviewAnswer: text("review_answer"),
  reviewAnsweredBy: integer("review_answered_by").references(() => users.id),
  reviewAnsweredAt: timestamp("review_answered_at"),
  source: text("source").notNull().default("manual"), // manual | import
  importBatchId: integer("import_batch_id"),
  docNo: text("doc_no"),
  fingerprint: text("fingerprint"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (t) => ({
  fpUniq: uniqueIndex("tx_fingerprint_uniq").on(t.householdId, t.fingerprint),
  byMonth: index("tx_household_date").on(t.householdId, t.txDate)
}));

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  transactionId: integer("transaction_id").references(() => transactions.id),
  assetId: integer("asset_id"),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: text("data").notNull() // base64; v1 keeps files in Postgres, R2 later
});

// ---------- assets & goals ----------
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  purchaseDate: date("purchase_date").notNull(),
  purchasePrice: numeric("purchase_price", { precision: 14, scale: 2 }).notNull(),
  status: text("status").notNull().default("active"), // active | sold
  soldDate: date("sold_date"),
  soldPrice: numeric("sold_price", { precision: 14, scale: 2 }),
  notes: text("notes")
});

export const assetValues = pgTable("asset_values", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  valuedOn: date("valued_on").notNull(),
  value: numeric("value", { precision: 14, scale: 2 }).notNull()
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
  deadline: date("deadline"),
  status: text("status").notNull().default("active"), // active | done
  linkedAssetId: integer("linked_asset_id")
});

export const goalContributions = pgTable("goal_contributions", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => goals.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  onDate: date("on_date").notNull(),
  note: text("note")
});

// ---------- csv import ----------
export const importBatches = pgTable("import_batches", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  filename: text("filename").notNull(),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }),
  closingBalance: numeric("closing_balance", { precision: 14, scale: 2 }),
  rowCount: integer("row_count").notNull().default(0),
  importedCount: integer("imported_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  ignoredCount: integer("ignored_count").notNull().default(0),
  balanceOk: boolean("balance_ok"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const importRules = pgTable("import_rules", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  pattern: text("pattern").notNull(), // UPPERCASE substring matched on description
  setCategoryId: integer("set_category_id").references(() => categories.id),
  setPersonId: integer("set_person_id").references(() => persons.id),
  setPassthrough: boolean("set_passthrough").notNull().default(false),
  setAbnormal: boolean("set_abnormal").notNull().default(false),
  priority: integer("priority").notNull().default(100)
});

// ---------- notifications ----------
/**
 * Household-scoped activity feed shown in the header bell.
 *
 * Rows are written by whatever produced the event (an import finishing, a
 * budget being exceeded, a goal reaching its target). `readAt` is per-user so
 * Abdullah clearing the bell doesn't clear it for Tooba.
 */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  // null = everyone in the household sees it
  userId: integer("user_id").references(() => users.id),
  // Whoever caused the event: they should not be told about their own action.
  excludeUserId: integer("exclude_user_id").references(() => users.id),
  kind: text("kind").notNull(), // import | budget | goal | review | asset
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// ---------- conversation ----------
/**
 * Threaded comments, attachable to any entity.
 *
 * Replaces the single reviewNote/reviewAnswer pair: real exchanges need
 * follow-ups ("which plot?" → "LDA City"). Generic over entity so the same
 * thread UI serves transactions, assets and goals rather than three tables.
 */
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => households.id),
  entityType: text("entity_type").notNull(), // transaction | asset | goal
  entityId: integer("entity_id"),
  userId: integer("user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

/** One row per (comment, user, emoji) — a unique index makes toggling idempotent. */
export const commentReactions = pgTable("comment_reactions", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
