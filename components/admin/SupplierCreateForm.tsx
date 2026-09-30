"use client";

// components/admin/SupplierCreateForm.tsx —— 供应商新建表单（CS-03）
//
// 与 SupplierEditor 同一思路：朴素、字段全、错误看得见。
// 提交走 POST /api/admin/suppliers（服务端白名单 + requireAdmin + 高信任 422 拦截）。
// 本组件不做权限判断 —— 权限在服务端。
//
// 关键约束（CS-03）：
//   - 新建永远 is_published=false / verification_level=unverified（UI 只显示徽章，不给开关）
//   - 不暴露"设为 Verified / Audited / Published"的任何输入
//   - 认证只作为"声称"录入，写 supplier_certifications(SELF_DECLARED)

import { useState } from "react";

export type SupplierCreateDict = {
  title: string;
  lead: string;
  slugLabel: string;
  slugHint: string;
  suggest: string;
  legalNameLabel: string;
  cityLabel: string;
  countryLabel: string;
  countryHint: string;
  displayNameLabel: string;
  displayNameHint: string;
  industryLabel: string;
  businessTypeLabel: string;
  establishedLabel: string;
  employeesLabel: string;
  websiteLabel: string;
  websiteHint: string;
  mainProductsLabel: string;
  mainProductsHint: string;
  phoneLabel: string;
  addressLabel: string;
  regNoLabel: string;
  sourceTitle: string;
  sourceUrlLabel: string;
  sourceTypeLabel: string;
  sourceNameLabel: string;
  sourceHint: string;
  certTitle: string;
  certHint: string;
  certPlaceholder: string;
  addCert: string;
  removeCert: string;
  submit: string;
  submitting: string;
  success: string;
  newId: string;
  viewLink: string;
  dupTitle: string;
  dupFound: string;
  dupField: string;
  errGeneric: string;
  statusUnpublished: string;
  statusUnverified: string;
};

type Props = { locale: string; dict: SupplierCreateDict };

function localSlugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);
}

export default function SupplierCreateForm({ locale, dict }: Props) {
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [established, setEstablished] = useState("");
  const [employees, setEmployees] = useState("");
  const [website, setWebsite] = useState("");
  const [mainProducts, setMainProducts] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [regNo, setRegNo] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [certs, setCerts] = useState<string[]>([""]);

  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "error" | "dup"
  >("idle");
  const [msg, setMsg] = useState<{ id?: string; slug?: string; field?: string; error?: string }>(
    {}
  );

  const inputClass =
    "w-full rounded-md border border-[#ebe8e1] px-3 py-2 text-sm text-[#171717] focus:border-[#171717] focus:outline-none";

  function autoSlug() {
    if (!slugTouched && (legalName || city)) {
      setSlug(localSlugify(`${legalName} ${city}`));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setMsg({});
    const body = {
      slug,
      legal_name: legalName,
      city,
      country_code: country,
      display_name: displayName || null,
      industry_code: industry || null,
      business_type: businessType || null,
      established: established || null,
      employees: employees || null,
      website: website || null,
      main_products: mainProducts,
      phone: phone || null,
      address: address || null,
      registration_number: regNo || null,
      source_url: sourceUrl || null,
      source_type: sourceType || null,
      source_name: sourceName || null,
      certificationClaims: certs.map((c) => c.trim()).filter(Boolean),
    };
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        slug?: string;
        error?: string;
        existing_slug?: string;
        field?: string;
      };
      if (res.status === 201 && data.ok) {
        setStatus("saved");
        setMsg({ id: data.id, slug: data.slug });
        return;
      }
      if (res.status === 409 && data.existing_slug) {
        setStatus("dup");
        setMsg({ slug: data.existing_slug, field: data.field });
        return;
      }
      setStatus("error");
      setMsg({ error: data.error ?? "unknown" });
    } catch {
      setStatus("error");
      setMsg({ error: "network" });
    }
  }

  const editHref = msg.slug ? `/${locale}/admin/suppliers/${encodeURIComponent(msg.slug)}` : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#171717]">{dict.title}</h1>
        <p className="mt-1 text-sm text-[#6d6b66]">{dict.lead}</p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs text-[#92400e]">
            {dict.statusUnpublished}
          </span>
          <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs text-[#92400e]">
            {dict.statusUnverified}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.legalNameLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={legalName}
              onChange={(e) => {
                setLegalName(e.target.value);
                autoSlug();
              }}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.cityLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                autoSlug();
              }}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.slugLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
            />
            <span className="mt-1 block text-xs text-[#8c8982]">{dict.slugHint}</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.countryLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={country}
              onChange={(e) => setCountry(e.target.value.toLowerCase())}
              placeholder="china / vietnam"
            />
            <span className="mt-1 block text-xs text-[#8c8982]">{dict.countryHint}</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.displayNameLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <span className="mt-1 block text-xs text-[#8c8982]">{dict.displayNameHint}</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.industryLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.businessTypeLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.establishedLabel}</span>
            <input
              type="number"
              className={`mt-1 ${inputClass}`}
              value={established}
              onChange={(e) => setEstablished(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.employeesLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={employees}
              onChange={(e) => setEmployees(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.websiteLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
            <span className="mt-1 block text-xs text-[#8c8982]">{dict.websiteHint}</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.phoneLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#171717]">{dict.regNoLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-[#171717]">{dict.addressLabel}</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-[#171717]">{dict.mainProductsLabel}</span>
            <textarea
              className={`mt-1 ${inputClass}`}
              rows={2}
              value={mainProducts}
              onChange={(e) => setMainProducts(e.target.value)}
            />
            <span className="mt-1 block text-xs text-[#8c8982]">{dict.mainProductsHint}</span>
          </label>
        </div>

        <fieldset className="rounded-lg border border-[#ebe8e1] p-4">
          <legend className="px-1 text-sm font-semibold text-[#171717]">{dict.sourceTitle}</legend>
          <p className="mb-3 text-xs text-[#6d6b66]">{dict.sourceHint}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-[#171717]">{dict.sourceUrlLabel}</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#171717]">{dict.sourceTypeLabel}</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#171717]">{dict.sourceNameLabel}</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-[#ebe8e1] p-4">
          <legend className="px-1 text-sm font-semibold text-[#171717]">{dict.certTitle}</legend>
          <p className="mb-3 text-xs text-[#6d6b66]">{dict.certHint}</p>
          <div className="space-y-2">
            {certs.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={`flex-1 ${inputClass}`}
                  value={c}
                  placeholder={dict.certPlaceholder}
                  onChange={(e) => {
                    const next = [...certs];
                    next[i] = e.target.value;
                    setCerts(next);
                  }}
                />
                {certs.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-[#d4232a] hover:underline"
                    onClick={() => setCerts(certs.filter((_, j) => j !== i))}
                  >
                    {dict.removeCert}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-[#171717] hover:underline"
            onClick={() => setCerts([...certs, ""])}
          >
            + {dict.addCert}
          </button>
        </fieldset>

        <div className="flex items-center gap-4 border-t border-[#ebe8e1] pt-4">
          <button
            type="submit"
            disabled={status === "saving"}
            className="btn btn-primary disabled:opacity-70"
          >
            {status === "saving" ? dict.submitting : dict.submit}
          </button>
          {status === "saved" && (
            <span className="text-sm text-[#171717]">{dict.success}</span>
          )}
          {status === "error" && (
            <span className="text-sm text-[#d4232a]">
              {dict.errGeneric}
              {msg.error ? ` (${msg.error})` : ""}
            </span>
          )}
        </div>
      </form>

      {status === "saved" && msg.id && (
        <div className="card border-[#171717] p-4">
          <p className="text-sm text-[#171717]">
            <span className="font-medium">{dict.newId}:</span>{" "}
            <code className="rounded bg-[#f5f3ee] px-1">{msg.id}</code>
          </p>
          {editHref && (
            <a href={editHref} className="mt-2 inline-block text-sm text-[#171717] hover:underline">
              {dict.viewLink} →
            </a>
          )}
        </div>
      )}

      {status === "dup" && msg.slug && (
        <div className="card border-[#d4232a] p-4">
          <p className="text-sm font-medium text-[#171717]">{dict.dupTitle}</p>
          <p className="mt-1 text-sm text-[#3f4650]">
            {dict.dupFound.replace("{slug}", msg.slug)}
            {msg.field ? ` (${dict.dupField.replace("{field}", msg.field)})` : ""}
          </p>
          <a
            href={`/${locale}/admin/suppliers/${encodeURIComponent(msg.slug)}`}
            className="mt-2 inline-block text-sm text-[#171717] hover:underline"
          >
            {dict.viewLink} →
          </a>
        </div>
      )}
    </div>
  );
}
