# -*- coding: utf-8 -*-
"""本地 zh-TW 繁化冒烟：抓页面 HTML，统计繁体/简体特征字命中。
用法: python scripts/check-tw-live.py <base> [路径...]
"""
import sys, re, gzip, io
import urllib.request

PAIRS = [
    ("证","證"),("验","驗"),("厂","廠"),("质","質"),("体","體"),("审","審"),("检","檢"),
    ("测","測"),("制","製"),("营","營"),("执","執"),("护","護"),("标","標"),("准","準"),
    ("产","產"),("电","電"),("应","應"),("个","個"),("别","別"),("权","權"),("说","說"),
    ("设","設"),("备","備"),("议","議"),("项","項"),("资","資"),("讯","訊"),("显","顯"),
    ("区","區"),("场","場"),("专","專"),("业","業"),("员","員"),("会","會"),("评","評"),
    ("价","價"),("风","風"),("险","險"),("链","鏈"),("条","條"),("样","樣"),("书","書"),
    ("类","類"),("规","規"),("单","單"),("据","據"),("总","總"),("额","額"),("记","記"),
    ("买","買"),("卖","賣"),("开","開"),("发","發"),("订","訂"),("确","確"),("认","認"),
    ("时","時"),("问","問"),("实","實"),("现","現"),("网","網"),("络","絡"),("数","數"),
    ("报","報"),
]
SIM = {s for s, t in PAIRS}
TRAD = {t for s, t in PAIRS}
# 本身就是简体专用的强特征字（出现即代表简体泄漏）
STRONG_SIM = "证验厂质体审检测执护标产电应个权说设备议项资显区场专业员评价风险链条样书类规单总额记买卖开发订确认时问实现网络数"

# 语言切换器里的语种名本身就是「简体中文 / 繁體中文」，属于预期混排，统计前剔除
LOCALE_NAMES = [
    "简体中文", "繁體中文", "简体", "繁體",
    "English", "Español", "Deutsch", "Français", "Português", "日本語", "العربية",
]

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
opener.addheaders = [("User-Agent", "Mozilla/5.0"), ("Accept-Encoding", "gzip")]


def fetch(url):
    with opener.open(url, timeout=30) as r:
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
    return html


def check(url, expect):
    """expect: 'trad' 期望繁体（简体强特征字必须为 0），'sim' 期望简体（繁体强特征字必须为 0）"""
    html = fetch(url)
    text = strip_html(html)
    trad = sum(1 for ch in text if ch in TRAD)
    sim = sum(1 for ch in text if ch in SIM)
    leaks = sorted({ch for ch in text if ch in (STRONG_SIM if expect == "trad" else "".join(TRAD))})
    ok = (trad > 0 and not leaks) if expect == "trad" else (sim > 0 and not leaks)
    flag = "OK " if ok else "!! "
    kind = "简体泄漏字" if expect == "trad" else "繁体残留字"
    print(f"{flag}{url}\n    繁={trad} 简={sim} {kind}={''.join(leaks) if leaks else '无'}")
    return ok


if __name__ == "__main__":
    base = sys.argv[1].rstrip("/")
    paths = sys.argv[2:] or ["/"]
    results = []
    for p in paths:
        for loc, exp in (("zh-TW", "trad"), ("zh", "sim")):
            url = f"{base}/{loc}{p}"
            try:
                results.append(check(url, exp))
            except Exception as e:
                print(f"!! {url}\n    ERROR {e}")
                results.append(False)
    print(f"\n==== {sum(results)}/{len(results)} 通过 ====")
    sys.exit(0 if all(results) else 1)
