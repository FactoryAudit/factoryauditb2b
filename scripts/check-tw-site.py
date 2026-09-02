# -*- coding: utf-8 -*-
"""全站 zh / zh-TW 繁简体检（sitemap 驱动）。

从 sitemap.xml 取出全部 URL，逐个抓取 /zh-TW/ 与 /zh/ 两个版本：
  /zh-TW/  期望繁体 —— 命中「简体强特征字」即为泄漏
  /zh/     期望简体 —— 命中「繁体强特征字」即为残留
只打印异常页，末尾给汇总。

用法: python scripts/check-tw-site.py [base] [--limit N] [--sitemap FILE]
"""
import argparse
import gzip
import io
import re
import sys
import time
import urllib.request

# 繁简一一对应的强特征字对（其余繁简同形字不列入，避免误报）
PAIRS = [
    ("证", "證"), ("验", "驗"), ("厂", "廠"), ("质", "質"), ("体", "體"), ("审", "審"), ("检", "檢"),
    ("测", "測"), ("制", "製"), ("营", "營"), ("执", "執"), ("护", "護"), ("标", "標"), ("准", "準"),
    ("产", "產"), ("电", "電"), ("应", "應"), ("个", "個"), ("别", "別"), ("权", "權"), ("说", "說"),
    ("设", "設"), ("备", "備"), ("议", "議"), ("项", "項"), ("资", "資"), ("讯", "訊"), ("显", "顯"),
    ("区", "區"), ("场", "場"), ("专", "專"), ("业", "業"), ("员", "員"), ("会", "會"), ("评", "評"),
    ("价", "價"), ("风", "風"), ("险", "險"), ("链", "鏈"), ("条", "條"), ("样", "樣"), ("书", "書"),
    ("类", "類"), ("规", "規"), ("单", "單"), ("据", "據"), ("总", "總"), ("额", "額"), ("记", "記"),
    ("买", "買"), ("卖", "賣"), ("开", "開"), ("发", "發"), ("订", "訂"), ("确", "確"), ("认", "認"),
    ("时", "時"), ("问", "問"), ("实", "實"), ("现", "現"), ("网", "網"), ("络", "絡"), ("数", "數"),
    ("报", "報"),
]
SIM = {s for s, _ in PAIRS}
# 以下两字是繁简同形/歧义字，繁体文本里合法存在，不能当「简体泄漏」的特征字：
#   「制」—— 控制、制度 在繁体里就是「制」，只有 制造 才是「製造」
#   「准」—— 准入、核准、批准 在繁体里就是「准」，只有 准許/標準 才转「準」
# （真出问题时 标→標、许→許 等无歧义字仍会命中，检测能力不受影响）
SIM -= {"制", "准"}
TRAD = {t for _, t in PAIRS}
TRAD -= {"製"}

# 语言切换器里的语种名本身是预期混排，统计前剔除
LOCALE_NAMES = [
    "简体中文", "繁體中文", "简体", "繁體",
    "English", "Español", "Deutsch", "Français", "Português", "日本語", "العربية",
]

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
opener.addheaders = [("User-Agent", "Mozilla/5.0"), ("Accept-Encoding", "gzip")]


def fetch(url, timeout=40):
    with opener.open(url, timeout=timeout) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
        return raw.decode("utf-8", "replace")


def strip_html(html):
    html = re.sub(r"<script[\s\S]*?</script>", " ", html)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html)
    html = re.sub(r"<[^>]+>", " ", html)
    for n in LOCALE_NAMES:
        html = html.replace(n, " ")
    return re.sub(r"\s+", " ", html)


def check(url, expect):
    """返回 (ok, 统计字典)。expect: 'trad' | 'sim'"""
    text = strip_html(fetch(url))
    trad = sum(1 for ch in text if ch in TRAD)
    sim = sum(1 for ch in text if ch in SIM)
    bad_chars = SIM if expect == "trad" else TRAD
    leaks = {}
    for ch in text:
        if ch in bad_chars:
            leaks.setdefault(ch, 0)
            leaks[ch] += 1
    ok = (not leaks) and ((trad > 0) if expect == "trad" else (sim > 0))
    return ok, {"trad": trad, "sim": sim, "leaks": leaks, "text": text}


def sitemap_urls(sitemap_file=None, base=""):
    if sitemap_file:
        xml = open(sitemap_file, encoding="utf-8").read()
    else:
        xml = fetch(base + "/sitemap.xml")
    return re.findall(r"<loc>\s*(.*?)\s*</loc>", xml)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", default="https://factoryauditb2b.com")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--sitemap", default=None)
    ap.add_argument("--ctx", type=int, default=45, help="每个泄漏字的上下文长度")
    args = ap.parse_args()
    base = args.base.rstrip("/")

    urls = sitemap_urls(args.sitemap, base)
    targets = []
    for u in urls:
        path = u[len(base):] if u.startswith(base) else u
        if path.startswith("/zh-TW/"):
            targets.append((u, "trad"))
        elif path.startswith("/zh/") or path == "/zh":
            targets.append((u, "sim"))
    targets.sort(key=lambda x: (x[1], x[0]))
    if args.limit:
        targets = targets[: args.limit]

    print(f"sitemap URL {len(urls)} 条，待检 zh-TW / zh 共 {len(targets)} 条\n")
    failed = []
    for i, (url, expect) in enumerate(targets, 1):
        # 生产环境偶发 503 / SSL EOF / 连接被重置，重试 3 次再判失败
        st = err = None
        for attempt in range(3):
            try:
                ok, st = check(url, expect)
                err = None
                break
            except Exception as e:  # noqa: BLE001 - 网络异常一律重试
                err = e
                # 生产环境 503 多为短时限流，立刻重试通常还是 503，退避后再试
                if attempt < 2:
                    time.sleep(3 * (attempt + 1))
        if err is not None:
            print(f"[{i}/{len(targets)}] !! ERROR {url} -> {err}")
            failed.append((url, expect, {"ERROR": str(err)}))
            continue
        if not ok:
            failed.append((url, expect, st["leaks"]))
            kind = "简体泄漏" if expect == "trad" else "繁体残留"
            print(f"[{i}/{len(targets)}] !! {url}")
            print(f"    繁={st['trad']} 简={st['sim']}  {kind}: {st['leaks']}")
            text = st["text"]
            for ch in st["leaks"]:
                m = re.search(re.escape(ch), text)
                if m:
                    print(f"      [{ch}] …{text[max(0, m.start()-args.ctx):m.start()+args.ctx//2]}…")
        if i % 50 == 0:
            print(f"    …已检 {i}/{len(targets)}，累计异常 {len(failed)}", flush=True)

    print(f"\n==== 检查 {len(targets)} 页，异常 {len(failed)} 页 ====")
    for url, expect, leaks in failed:
        print(f"  {url}  {leaks}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
