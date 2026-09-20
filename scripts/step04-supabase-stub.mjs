// STEP-04 夹具测试专用 Supabase 桩（**仅测试用，不进产物**）
//
// 通过 esbuild 的 onResolve 把 `./supabaseAdmin` 换成这个文件，
// 让 `lib/queries.ts` / `lib/industrialClusters.ts` 的**真实代码**跑在可控夹具上。
// 计数每一次 `.from(table)`，用于证明「零 slug ⇒ 零查询」「批量 ⇒ 非 N+1」。

class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.cols = null;
    this.opts = null;
  }
  select(cols, opts) {
    this.cols = cols;
    this.opts = opts ?? null;
    return this;
  }
  eq(col, val) {
    this.filters.push({ op: "eq", col, val });
    return this;
  }
  in(col, val) {
    this.filters.push({ op: "in", col, val });
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle() {
    return this._exec(true);
  }
  single() {
    return this._exec(true);
  }
  then(onFulfilled, onRejected) {
    return this._exec(false).then(onFulfilled, onRejected);
  }
  insert() {
    return { select: () => ({ single: async () => ({ data: { id: "inserted" }, error: null }) }) };
  }
  update() {
    return { eq: async () => ({ error: null }) };
  }
  delete() {
    return { eq: async () => ({ error: null }) };
  }
  async _exec(single) {
    const st = globalThis.__STUB_STATE__;
    st.queries.push({
      table: this.table,
      cols: this.cols,
      filters: this.filters.map((f) => ({ ...f, val: Array.isArray(f.val) ? [...f.val] : f.val })),
    });
    let rows = (st.tables[this.table] ?? []).slice();
    for (const f of this.filters) {
      if (f.op === "eq") rows = rows.filter((r) => r[f.col] === f.val);
      if (f.op === "in") rows = rows.filter((r) => f.val.includes(r[f.col]));
    }
    if (st.failTables?.includes(this.table)) {
      return { data: null, error: { code: "XX000", message: "stub injected failure" } };
    }
    if (single) return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  }
}

export function createAdminClient() {
  return {
    from(table) {
      return new Query(table);
    },
  };
}

export function isAdminConfigured() {
  return true;
}

export function isSupabaseConfigured() {
  return true;
}
