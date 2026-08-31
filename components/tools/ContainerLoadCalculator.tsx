"use client";

import { useMemo, useState } from "react";

export type ContainerUiDict = {
  cargoTitle: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  quantity: string;
  optionsTitle: string;
  clearance: string;
  clearanceHelp: string;
  allowRotate: string;
  allowRotateHelp: string;
  calcBtn: string;
  resetBtn: string;
  resultsTitle: string;
  bestFit: string;
  perContainer: string;
  containersNeeded: string;
  arrangement: string;
  along: string;
  across: string;
  layers: string;
  volumeUsed: string;
  payloadUsed: string;
  totalVolume: string;
  totalWeight: string;
  comparisonTitle: string;
  containerCol: string;
  fitsCol: string;
  neededCol: string;
  topView: string;
  warnOverweight: string;
  warnTooLarge: string;
  warnDoor: string;
  empty: string;
  disclaimer: string;
};

/** 柜型名（General purpose / High cube / Reefer / Open top）—— 与 ui 平级，单独传入 */
export type ContainerTypeLabels = Record<string, string>;

/** 规格表列名（内部尺寸 / 容积 / 最大载重 / 箱门）—— 与 ui 平级，单独传入 */
export type ContainerSpecLabels = {
  internal: string;
  door: string;
  capacity: string;
  payload: string;
};

// ISO 集装箱典型规格（内部尺寸 mm、门框 mm、容积 m³、最大载重 kg）
// 数据为行业通用典型值，实际以承运人或箱东提供的规格为准。
type Container = {
  code: string;
  typeKey: string;
  l: number;
  w: number;
  h: number;
  doorW: number;
  doorH: number;
  volume: number;
  payload: number;
};

export const CONTAINERS: Container[] = [
  { code: "20GP", typeKey: "generalPurpose", l: 5898, w: 2352, h: 2393, doorW: 2340, doorH: 2280, volume: 33.2, payload: 28000 },
  { code: "40GP", typeKey: "generalPurpose", l: 12032, w: 2352, h: 2393, doorW: 2340, doorH: 2280, volume: 67.7, payload: 26500 },
  { code: "40HQ", typeKey: "highCube", l: 12032, w: 2352, h: 2698, doorW: 2340, doorH: 2585, volume: 76.4, payload: 26500 },
  { code: "45HQ", typeKey: "highCube", l: 13556, w: 2352, h: 2698, doorW: 2340, doorH: 2585, volume: 86.1, payload: 27600 },
  { code: "20RF", typeKey: "reefer", l: 5450, w: 2290, h: 2270, doorW: 2290, doorH: 2200, volume: 28.3, payload: 27400 },
  { code: "40RF", typeKey: "reefer", l: 11580, w: 2290, h: 2500, doorW: 2290, doorH: 2400, volume: 66.3, payload: 27700 },
  { code: "20OT", typeKey: "openTop", l: 5900, w: 2330, h: 2330, doorW: 2330, doorH: 2270, volume: 32.1, payload: 28000 },
  { code: "40OT", typeKey: "openTop", l: 12000, w: 2330, h: 2330, doorW: 2330, doorH: 2270, volume: 65.2, payload: 26600 },
];

type Unit = "cm" | "in";
type MassUnit = "kg" | "lb";

type Plan = {
  code: string;
  typeKey: string;
  along: number;
  across: number;
  layers: number;
  bySpace: number;
  byWeight: number;
  fits: number;
  needed: number;
  volumeUsed: number;
  payloadUsed: number;
  doorOk: boolean;
  tooLarge: boolean;
};

const MM_PER_IN = 25.4;
const KG_PER_LB = 0.45359237;

export default function ContainerLoadCalculator({
  t,
  types,
  specs,
}: {
  t: ContainerUiDict;
  types: ContainerTypeLabels;
  specs: ContainerSpecLabels;
}) {
  const [unit, setUnit] = useState<Unit>("cm");
  const [massUnit, setMassUnit] = useState<MassUnit>("kg");
  const [l, setL] = useState("40");
  const [w, setW] = useState("30");
  const [h, setH] = useState("30");
  const [weight, setWeight] = useState("12");
  const [qty, setQty] = useState("1000");
  const [clearance, setClearance] = useState("0");
  const [allowRotate, setAllowRotate] = useState(true);

  const parsed = useMemo(() => {
    const f = (v: string) => {
      const n = parseFloat(v);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const toMm = (v: number) => (unit === "cm" ? v * 10 : v * MM_PER_IN);
    const toKg = (v: number) => (massUnit === "kg" ? v : v * KG_PER_LB);
    return {
      l: toMm(f(l)),
      w: toMm(f(w)),
      hh: toMm(f(h)),
      weight: toKg(f(weight)),
      qty: Math.floor(f(qty)),
      clearance: toMm(f(clearance)),
    };
  }, [l, w, h, weight, qty, clearance, unit, massUnit]);

  const valid = parsed.l > 0 && parsed.w > 0 && parsed.hh > 0 && parsed.qty > 0;

  const plans = useMemo<Plan[]>(() => {
    if (!valid) return [];
    const dims = [parsed.l, parsed.w, parsed.hh];
    const gap = parsed.clearance * 2;
    const base: [number, number, number][] = allowRotate
      ? [
          [dims[0], dims[1], dims[2]],
          [dims[0], dims[2], dims[1]],
          [dims[1], dims[0], dims[2]],
          [dims[1], dims[2], dims[0]],
          [dims[2], dims[0], dims[1]],
          [dims[2], dims[1], dims[0]],
        ]
      : [[dims[0], dims[1], dims[2]]];

    return CONTAINERS.map((c) => {
      let best = { along: 0, across: 0, layers: 0, bySpace: 0 };
      for (const [a, b, cc] of base) {
        const along = Math.floor(c.l / (a + gap));
        const across = Math.floor(c.w / (b + gap));
        const layers = Math.floor(c.h / (cc + gap));
        const total = along * across * layers;
        if (total > best.bySpace) best = { along, across, layers, bySpace: total };
      }
      const byWeight = parsed.weight > 0 ? Math.floor(c.payload / parsed.weight) : Infinity;
      const fits = Math.min(best.bySpace, byWeight === Infinity ? best.bySpace : byWeight);
      const loaded = Math.min(parsed.qty, fits);
      const unitVol = (parsed.l / 1000) * (parsed.w / 1000) * (parsed.hh / 1000);
      return {
        code: c.code,
        typeKey: c.typeKey,
        along: best.along,
        across: best.across,
        layers: best.layers,
        bySpace: best.bySpace,
        byWeight: byWeight === Infinity ? 0 : byWeight,
        fits,
        needed: fits > 0 ? Math.ceil(parsed.qty / fits) : 0,
        volumeUsed: fits > 0 ? Math.min(100, ((unitVol * loaded) / c.volume) * 100) : 0,
        payloadUsed: parsed.weight > 0 ? Math.min(100, ((parsed.weight * loaded) / c.payload) * 100) : 0,
        doorOk: allowRotate
          ? dims.some((d, i) => {
              const others = dims.filter((_, j) => j !== i);
              return d + gap <= c.doorH && (others[0] + gap <= c.doorW || others[1] + gap <= c.doorW);
            })
          : parsed.w + gap <= c.doorW && parsed.hh + gap <= c.doorH,
        tooLarge: best.bySpace === 0,
      };
    });
  }, [parsed, allowRotate, valid]);

  const usable = plans.filter((p) => !p.tooLarge && p.fits > 0);
  const recommended = useMemo(() => {
    if (!usable.length) return null;
    return [...usable].sort((a, b) => a.needed - b.needed || b.volumeUsed - a.volumeUsed)[0];
  }, [usable]);

  const unitLabel = unit === "cm" ? "cm" : "in";
  const massLabel = massUnit === "kg" ? "kg" : "lb";
  const totalVolume = valid ? ((parsed.l / 1000) * (parsed.w / 1000) * (parsed.hh / 1000) * parsed.qty) : 0;
  const totalWeight = valid ? parsed.weight * parsed.qty : 0;

  function reset() {
    setL("40");
    setW("30");
    setH("30");
    setWeight("12");
    setQty("1000");
    setClearance("0");
    setAllowRotate(true);
  }

  const spec = CONTAINERS.find((c) => c.code === recommended?.code);

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      {/* 输入区 */}
      <form
        className="card p-6 space-y-5"
        onSubmit={(e) => e.preventDefault()}
        aria-label={t.cargoTitle}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#0f172a]">{t.cargoTitle}</h2>
            <div className="flex gap-1" role="group" aria-label="Unit">
              {(["cm", "in"] as Unit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  className={`px-2 py-1 text-xs rounded border ${
                    unit === u
                      ? "border-[#0f4c81] bg-[#0f4c81] text-white"
                      : "border-[#e2e8f0] text-[#475569]"
                  }`}
                >
                  {u === "cm" ? "cm" : "in"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field id="cargoLength" label={`${t.length} (${unitLabel})`} value={l} onChange={setL} />
            <Field id="cargoWidth" label={`${t.width} (${unitLabel})`} value={w} onChange={setW} />
            <Field id="cargoHeight" label={`${t.height} (${unitLabel})`} value={h} onChange={setH} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="font-semibold text-[#0f172a]" htmlFor="cargoWeight">
              {t.weight}
            </label>
            <div className="flex gap-1" role="group" aria-label="Mass unit">
              {(["kg", "lb"] as MassUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setMassUnit(u)}
                  aria-pressed={massUnit === u}
                  className={`px-2 py-1 text-xs rounded border ${
                    massUnit === u
                      ? "border-[#0f4c81] bg-[#0f4c81] text-white"
                      : "border-[#e2e8f0] text-[#475569]"
                  }`}
                >
                  {u === "kg" ? "kg" : "lb"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field id="cargoWeight" label={`${t.weight} (${massLabel})`} value={weight} onChange={setWeight} />
            <Field id="cargoQty" label={t.quantity} value={qty} onChange={setQty} />
          </div>
        </div>

        <fieldset className="border-t border-[#e2e8f0] pt-4">
          <legend className="font-semibold text-[#0f172a] mb-2">{t.optionsTitle}</legend>
          <Field
            id="cargoClearance"
            label={`${t.clearance} (${unitLabel})`}
            value={clearance}
            onChange={setClearance}
            help={t.clearanceHelp}
          />
          <label className="flex items-start gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[#0f4c81]"
              checked={allowRotate}
              onChange={(e) => setAllowRotate(e.target.checked)}
              aria-describedby="rotateHelp"
            />
            <span className="text-sm text-[#334155]">
              {t.allowRotate}
              <span id="rotateHelp" className="block text-xs text-[#94a3b8]">
                {t.allowRotateHelp}
              </span>
            </span>
          </label>
        </fieldset>

        <div className="flex gap-2">
          <button type="button" className="btn btn-outline flex-1" onClick={reset}>
            {t.resetBtn}
          </button>
        </div>
      </form>

      {/* 结果区 */}
      <div className="space-y-6">
        {!valid ? (
          <div className="card p-8 text-center text-[#64748b]">{t.empty}</div>
        ) : recommended && spec ? (
          <>
            <section className="card p-6 border-[#0f4c81] border" aria-labelledby="resultHeading">
              <h2 id="resultHeading" className="sr-only">
                {t.resultsTitle}
              </h2>
              <div className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
                {t.bestFit}
              </div>
              <div className="text-4xl font-extrabold text-[#0f172a] mt-1">
                {recommended.code}
                <span className="ml-2 text-base font-medium text-[#64748b]">
                  {types[recommended.typeKey]}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                <div className="rounded-lg bg-[#f1f5f9] p-4">
                  <div className="text-xs text-[#64748b]">{t.perContainer}</div>
                  <div className="text-3xl font-bold text-[#0f172a]">{recommended.fits}</div>
                </div>
                <div className="rounded-lg bg-[#f1f5f9] p-4">
                  <div className="text-xs text-[#64748b]">{t.containersNeeded}</div>
                  <div className="text-3xl font-bold text-[#0f172a]">{recommended.needed}</div>
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-[#64748b]">{t.arrangement}</dt>
                  <dd className="font-medium text-[#0f172a]">
                    {recommended.along} {t.along} × {recommended.across} {t.across} ×{" "}
                    {recommended.layers} {t.layers}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#64748b]">
                    {t.volumeUsed} — {Math.round(recommended.volumeUsed)}%
                  </dt>
                  <dd>
                    <Bar pct={recommended.volumeUsed} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[#64748b]">
                    {t.payloadUsed} — {Math.round(recommended.payloadUsed)}%
                  </dt>
                  <dd>
                    <Bar pct={recommended.payloadUsed} />
                  </dd>
                </div>
                <div className="flex gap-6 pt-1">
                  <div>
                    <dt className="text-[#64748b]">{t.totalVolume}</dt>
                    <dd className="font-medium text-[#0f172a]">{totalVolume.toFixed(2)} m³</dd>
                  </div>
                  <div>
                    <dt className="text-[#64748b]">{t.totalWeight}</dt>
                    <dd className="font-medium text-[#0f172a]">
                      {totalWeight.toFixed(0)} {massLabel}
                    </dd>
                  </div>
                </div>
              </dl>

              {recommended.payloadUsed >= 100 && (
                <p className="mt-4 text-sm text-[#9b1c1c] bg-[#fdeaea] rounded-lg p-3">
                  {t.warnOverweight}
                </p>
              )}
              {!recommended.doorOk && (
                <p className="mt-3 text-sm text-[#a86a13] bg-[#fff4e0] rounded-lg p-3">
                  {t.warnDoor}
                </p>
              )}
            </section>

            {/* 俯视示意图 */}
            {recommended.along > 0 && recommended.across > 0 && (
              <section className="card p-6">
                <h3 className="font-semibold text-[#0f172a] mb-3">{t.topView}</h3>
                <TopView
                  along={recommended.along}
                  across={recommended.across}
                  ratio={spec.w / spec.l}
                />
              </section>
            )}
          </>
        ) : (
          <div className="card p-8 text-center text-[#9b1c1c]">{t.warnTooLarge}</div>
        )}

        {/* 全柜型对比 */}
        {valid && (
          <section className="card p-6 overflow-x-auto">
            <h3 className="font-semibold text-[#0f172a] mb-3">{t.comparisonTitle}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#64748b] border-b border-[#e2e8f0]">
                  <th scope="col" className="py-2 pr-3">{t.containerCol}</th>
                  <th scope="col" className="py-2 pr-3">{specs.internal}</th>
                  <th scope="col" className="py-2 pr-3">{specs.capacity}</th>
                  <th scope="col" className="py-2 pr-3">{specs.payload}</th>
                  <th scope="col" className="py-2 pr-3">{t.fitsCol}</th>
                  <th scope="col" className="py-2">{t.neededCol}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const c = CONTAINERS.find((x) => x.code === p.code)!;
                  const isBest = recommended?.code === p.code;
                  return (
                    <tr
                      key={p.code}
                      className={`border-b border-[#f1f5f9] ${isBest ? "bg-[#f1f7fb]" : ""}`}
                    >
                      <td className="py-2 pr-3 font-medium text-[#0f172a]">
                        {p.code}
                        {isBest && <span className="ml-1 text-[#0f4c81]">★</span>}
                      </td>
                      <td className="py-2 pr-3 text-[#475569]">
                        {(c.l / 10).toFixed(0)}×{(c.w / 10).toFixed(0)}×{(c.h / 10).toFixed(0)}
                      </td>
                      <td className="py-2 pr-3 text-[#475569]">{c.volume} m³</td>
                      <td className="py-2 pr-3 text-[#475569]">{(c.payload / 1000).toFixed(1)} t</td>
                      <td className="py-2 pr-3 text-[#475569]">{p.tooLarge ? "—" : p.fits}</td>
                      <td className="py-2 text-[#475569]">{p.needed || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <p className="text-xs text-[#94a3b8] text-center">{t.disclaimer}</p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  help?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[#475569] mb-1">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={help ? `${id}-help` : undefined}
        className="input w-full"
      />
      {help && (
        <span id={`${id}-help`} className="block text-xs text-[#94a3b8] mt-1">
          {help}
        </span>
      )}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  const capped = Math.min(100, Math.max(0, pct));
  const color = capped >= 95 ? "#d4232a" : capped >= 75 ? "#a86a13" : "#0f4c81";
  return (
    <div
      className="h-2.5 w-full rounded-full bg-[#eef2f7] mt-1"
      role="progressbar"
      aria-valuenow={Math.round(capped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-2.5 rounded-full transition-all"
        style={{ width: `${capped}%`, background: color }}
      />
    </div>
  );
}

function TopView({
  along,
  across,
  ratio,
}: {
  along: number;
  across: number;
  ratio: number;
}) {
  const cell = along > 24 ? 8 : along > 12 ? 16 : 26;
  const gap = 2;
  const gridW = along * (cell + gap);
  const gridH = across * (cell + gap);
  return (
    <div className="overflow-x-auto">
      <svg
        width={gridW + 4}
        height={gridH + 4}
        viewBox={`0 0 ${gridW + 4} ${gridH + 4}`}
        role="img"
        aria-label={`${along} by ${across} arrangement`}
        className="max-w-full"
      >
        <rect x="0" y="0" width={gridW + 4} height={gridH + 4} fill="#f1f5f9" rx="4" />
        {Array.from({ length: along * across }).map((_, i) => {
          const cx = i % along;
          const cy = Math.floor(i / along);
          return (
            <rect
              key={i}
              x={2 + cx * (cell + gap)}
              y={2 + cy * (cell + gap)}
              width={cell}
              height={cell}
              fill="#0f4c81"
              opacity="0.75"
              rx="2"
            />
          );
        })}
      </svg>
    </div>
  );
}
