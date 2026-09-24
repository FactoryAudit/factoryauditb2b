"use client";

import { useRef, useState } from "react";

export type CareersDict = Record<string, string>;

// CS-E / Careers：人才网络申请表（第一版不做账号、不做后台）。
// 提交走 /api/careers，简历以附件形式随邮件进管理员收件箱；
// 页面只负责收集与提示，类型/大小限制由服务端复检。
export default function CareersApplyForm({
  dict,
  locale,
  phSelect,
}: {
  dict: CareersDict;
  locale: string;
  /** 下拉框的中性占位文案。复用现有 toolsUi.riskAssessment.selectOption，
   *  Role / Availability 不能沿用 phCountry（"Select country / region"）。 */
  phSelect?: string;
}) {
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
  const [availability, setAvailability] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // 分类快捷入口：选中即等同选择对应 Role，并把焦点带到表单。
  // Project 在 Role 选项里没有对应项，归入 Other（Role 选项以表单字段表为准）。
  // 值直接用「邮箱里能读到的英文文本」而不是内部 code：
  // 申请最终以邮件形式归档，收件箱里 Role: Auditor 比 Role: auditor 更好搜、更好扫读。
  const R = {
    auditor: "Auditor",
    it: "IT",
    sourcing: "Sourcing",
    sales: "Sales",
    other: "Other",
  } as const;

  const chips: Array<{ label: string; value: string }> = [
    { label: dict.optRoleAuditor || "Auditor", value: R.auditor },
    { label: dict.optRoleSourcing || "Sourcing", value: R.sourcing },
    { label: dict.chipProject || "Project", value: R.other },
    { label: dict.chipItAi || "IT / AI", value: R.it },
    { label: dict.optRoleSales || "Sales", value: R.sales },
    { label: dict.optRoleOther || "Other", value: R.other },
  ];

  function pickChip(value: string) {
    setRole(value);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("role", role);
      fd.set("country", country);
      fd.set("availability", availability);
      fd.set("locale", locale);
      const res = await fetch("/api/careers", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        const map: Record<string, string> = {
          missing_fields: dict.errRequired,
          invalid_email: dict.errEmail,
          invalid_file_type: dict.errFileType,
          file_too_large: dict.errFileSize,
          cv_required: dict.errRequired,
        };
        setErr(map[String(j.error)] ?? dict.errSubmit);
        return;
      }
      setDone(true);
    } catch {
      setErr(dict.errSubmit);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section id="apply" className="card p-6 text-center">
        <p className="text-lg font-semibold text-[#0f172a]">{dict.thankYou}</p>
      </section>
    );
  }

  const inputCls =
    "mt-1 w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a]";
  const labelCls = "text-sm font-medium text-[#334155]";
  const selectPlaceholder = phSelect || dict.phCountry;

  return (
    <div id="apply">
      {/* 分类快捷入口 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.label + c.value}
            type="button"
            onClick={() => pickChip(c.value)}
            className={
              "rounded-full border px-4 py-2 text-sm font-medium transition " +
              (role === c.value
                ? "border-[#0f4c81] bg-[#0f4c81] text-white"
                : "border-[#cbd5e1] bg-white text-[#0f4c81] hover:border-[#0f4c81]")
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <section className="card p-6">
        <h2 className="text-xl font-bold text-[#0f172a]">{dict.formTitle}</h2>
        <form ref={formRef} onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="fullName">
              {dict.labelFullName}
            </label>
            <input id="fullName" name="fullName" required className={inputCls} />
          </div>

          <div>
            <label className={labelCls} htmlFor="country">
              {dict.labelCountryRegion}
            </label>
            <select
              id="country"
              name="country"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={inputCls}
            >
              <option value="">{dict.phCountry}</option>
              <option value="China">{dict.optChina}</option>
              <option value="Thailand">{dict.optThailand}</option>
              <option value="Vietnam">{dict.optVietnam}</option>
              <option value="Other">{dict.optOther}</option>
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="city">
              {dict.labelCity}
            </label>
            <input id="city" name="city" className={inputCls} />
          </div>

          <div>
            <label className={labelCls} htmlFor="role">
              {dict.labelRole}
            </label>
            <select
              id="role"
              name="role"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputCls}
            >
              <option value="">{selectPlaceholder}</option>
              <option value={R.auditor}>{dict.optRoleAuditor}</option>
              <option value={R.it}>{dict.optRoleIt}</option>
              <option value={R.sourcing}>{dict.optRoleSourcing}</option>
              <option value={R.sales}>{dict.optRoleSales}</option>
              <option value={R.other}>{dict.optRoleOther}</option>
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="specialization">
              {dict.labelSpecialization}
            </label>
            <input
              id="specialization"
              name="specialization"
              required
              placeholder={dict.phSpecialization}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="years">
              {dict.labelYears}
            </label>
            <input id="years" name="years" placeholder={dict.phYears} className={inputCls} />
          </div>

          <div>
            <label className={labelCls} htmlFor="languages">
              {dict.labelLanguages}
            </label>
            <input
              id="languages"
              name="languages"
              placeholder={dict.phLanguages}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="email">
              {dict.labelEmail}
            </label>
            <input id="email" name="email" type="email" required className={inputCls} />
          </div>

          <div>
            <label className={labelCls} htmlFor="phone">
              {dict.labelPhone}
            </label>
            <input id="phone" name="phone" className={inputCls} />
          </div>

          <div>
            <label className={labelCls} htmlFor="linkedin">
              {dict.labelLinkedin}
            </label>
            <input
              id="linkedin"
              name="linkedin"
              placeholder={dict.phLinkedin}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="availability">
              {dict.labelAvailability}
            </label>
            <select
              id="availability"
              name="availability"
              required
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className={inputCls}
            >
              <option value="">{selectPlaceholder}</option>
              <option value="Full-time">{dict.avFullTime}</option>
              <option value="Part-time">{dict.avPartTime}</option>
              <option value="Freelance">{dict.avFreelance}</option>
              <option value="Project-based">{dict.avProject}</option>
              <option value="Available for travel">{dict.avTravel}</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="cv">
              {dict.labelCv}
            </label>
            <input
              id="cv"
              name="cv"
              type="file"
              required
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="mt-1 w-full text-sm text-[#334155]"
            />
            <p className="mt-1 text-xs text-[#64748b]">{dict.fileHint}</p>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="introduction">
              {dict.labelIntro}
            </label>
            <textarea
              id="introduction"
              name="introduction"
              rows={4}
              placeholder={dict.phIntro}
              className={inputCls}
            />
          </div>

          {err && (
            <p className="sm:col-span-2 rounded border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-sm text-[#b42318]">
              {err}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary px-6 py-3 disabled:opacity-60"
            >
              {busy ? dict.submitting : dict.submit}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-[#64748b]">{dict.privacyNote}</p>
          </div>
        </form>
      </section>
    </div>
  );
}
