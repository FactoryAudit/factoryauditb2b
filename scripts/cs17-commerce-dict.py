# -*- coding: utf-8 -*-
"""
CS-17 Commerce V1 字典补齐：新增 `checkout` 与 `admin.orders` 两个命名空间。

铁律（沿用 cs16-admin-dict.py）：
  - io.open 读写两端 newline=""，写回时把 \\n 统一替换成 \\r\\n（项目 CRLF 约定）。
  - 只补缺失键（不覆盖已有翻译）。
  - 9 语键集必须与 en 完全一致（getDictionary 无深 fallback）。

翻译策略（与 CS-14 一致，非 CS-16）：
  只手写 en / zh / zh-TW 三语；其余 6 语回落到**准确英文**。
  理由：DEEPSEEK_API_KEY 为空 ⇒ 无机器翻译可用；
  而订单/收款文案属**合规与资金口径**，机器翻译的免责与金额表述风险高于英文直呈。
  后续有真实译员再补。
"""
import io
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_DIR = os.path.join(ROOT, "i18n", "dictionaries")
BACKUP_DIR = os.path.join(ROOT, ".workbuddy", "dict-backup-before-cs17")

LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"]
# 这三个语有真实译文；其余用英文兜底
REAL = {"en": "en", "zh": "zh", "zh-TW": "zh-TW"}

CHECKOUT = {
    "en": {
        "title": "Order received",
        "lead": "Your service order has been recorded. Keep the reference below for payment and follow-up.",
        "orderRef": "Order reference",
        "colService": "Service",
        "colQuantity": "Quantity",
        "colAmount": "Amount",
        "colStatus": "Status",
        "statusPending": "Awaiting payment",
        "statusPaid": "Paid",
        "statusCancelled": "Cancelled",
        "statusRefunded": "Refunded",
        "quoted": "To be quoted",
        "payTitle": "How to pay",
        "payPaypal": "Pay now with PayPal",
        "payManualTitle": "Payment instructions",
        "payManualBody": "Our team will email your order reference and payment instructions within one business day.",
        "bankTitle": "Bank transfer details",
        "referenceNote": "Quote this reference in your payment and in any follow-up.",
        "nextTitle": "What happens next",
        "nextBody": "We confirm the scope and price with you, then schedule the work once payment is received.",
        "notFoundTitle": "Order not found",
        "notFoundBody": "Check the reference in your confirmation email, or contact us and we will look it up.",
        "svcVerificationBasic": "Supplier verification — basic report",
        "svcVerificationPro": "Supplier verification — professional due diligence",
        "svcFactoryAudit": "On-site factory audit",
        "svcInspection": "Product inspection",
        "svcMonitoring": "Supplier monitoring",
        "svcCustom": "Custom scope",
        "unitPerSupplier": "per supplier",
        "unitManDay": "per man-day plus travel",
        "unitQuoted": "quoted per project",
    },
    "zh": {
        "title": "订单已提交",
        "lead": "您的服务订单已记录。请保留下方订单号，用于付款与后续沟通。",
        "orderRef": "订单号",
        "colService": "服务",
        "colQuantity": "数量",
        "colAmount": "金额",
        "colStatus": "状态",
        "statusPending": "待付款",
        "statusPaid": "已付款",
        "statusCancelled": "已取消",
        "statusRefunded": "已退款",
        "quoted": "待报价",
        "payTitle": "付款方式",
        "payPaypal": "使用 PayPal 立即付款",
        "payManualTitle": "付款指引",
        "payManualBody": "我们的团队将在一个工作日内通过邮件发送订单号与付款指引。",
        "bankTitle": "银行电汇信息",
        "referenceNote": "付款与后续沟通时请注明该订单号。",
        "nextTitle": "下一步",
        "nextBody": "我们会与您确认服务范围与价格，收到款项后安排执行。",
        "notFoundTitle": "未找到订单",
        "notFoundBody": "请核对确认邮件中的订单号，或联系我们协助查询。",
        "svcVerificationBasic": "供应商核验 — 基础报告",
        "svcVerificationPro": "供应商核验 — 专业尽调报告",
        "svcFactoryAudit": "现场验厂审核",
        "svcInspection": "产品验货",
        "svcMonitoring": "供应商持续监控",
        "svcCustom": "定制服务范围",
        "unitPerSupplier": "每家供应商",
        "unitManDay": "每人天，另加差旅",
        "unitQuoted": "按项目报价",
    },
    "zh-TW": {
        "title": "訂單已送出",
        "lead": "您的服務訂單已記錄。請保留下方訂單編號，用於付款與後續溝通。",
        "orderRef": "訂單編號",
        "colService": "服務",
        "colQuantity": "數量",
        "colAmount": "金額",
        "colStatus": "狀態",
        "statusPending": "待付款",
        "statusPaid": "已付款",
        "statusCancelled": "已取消",
        "statusRefunded": "已退款",
        "quoted": "待報價",
        "payTitle": "付款方式",
        "payPaypal": "使用 PayPal 立即付款",
        "payManualTitle": "付款指引",
        "payManualBody": "我們的團隊將在一個工作日內透過郵件寄送訂單編號與付款指引。",
        "bankTitle": "銀行電匯資訊",
        "referenceNote": "付款與後續溝通時請註明該訂單編號。",
        "nextTitle": "下一步",
        "nextBody": "我們會與您確認服務範圍與價格，收到款項後安排執行。",
        "notFoundTitle": "找不到訂單",
        "notFoundBody": "請核對確認郵件中的訂單編號，或聯繫我們協助查詢。",
        "svcVerificationBasic": "供應商核驗 — 基礎報告",
        "svcVerificationPro": "供應商核驗 — 專業盡調報告",
        "svcFactoryAudit": "現場驗廠審核",
        "svcInspection": "產品驗貨",
        "svcMonitoring": "供應商持續監控",
        "svcCustom": "客製服務範圍",
        "unitPerSupplier": "每家供應商",
        "unitManDay": "每人天，另加差旅",
        "unitQuoted": "按專案報價",
    },
}

ORDER = {
    "en": {
        "title": "Place an order",
        "lead": "Choose the service and quantity. We confirm the scope and price with you before payment.",
        "serviceLabel": "Service",
        "quantityLabel": "Quantity",
        "emailLabel": "Email",
        "companyLabel": "Company",
        "countryLabel": "Country",
        "notesLabel": "Notes",
        "notesHint": "Supplier name, factory country and your deadline.",
        "amountHint": "Prices are indicative. The final price is confirmed by our team before payment.",
        "submit": "Place order",
        "submitting": "Placing order…",
        "errorGeneric": "We could not place the order. Please try again or contact us.",
    },
    "zh": {
        "title": "提交订单",
        "lead": "选择服务与数量。付款前我们会与您确认服务范围与价格。",
        "serviceLabel": "服务",
        "quantityLabel": "数量",
        "emailLabel": "邮箱",
        "companyLabel": "公司",
        "countryLabel": "国家",
        "notesLabel": "备注",
        "notesHint": "供应商名称、工厂所在国家与您的时间要求。",
        "amountHint": "价格为参考区间。最终价格由我们的团队在付款前与您确认。",
        "submit": "提交订单",
        "submitting": "提交中…",
        "errorGeneric": "订单提交失败，请重试或联系我们。",
    },
    "zh-TW": {
        "title": "送出訂單",
        "lead": "選擇服務與數量。付款前我們會與您確認服務範圍與價格。",
        "serviceLabel": "服務",
        "quantityLabel": "數量",
        "emailLabel": "信箱",
        "companyLabel": "公司",
        "countryLabel": "國家",
        "notesLabel": "備註",
        "notesHint": "供應商名稱、工廠所在國家與您的時間要求。",
        "amountHint": "價格為參考區間。最終價格由我們的團隊在付款前與您確認。",
        "submit": "送出訂單",
        "submitting": "送出中…",
        "errorGeneric": "訂單送出失敗，請重試或聯絡我們。",
    },
}

ADMIN_ORDERS = {
    "en": {
        "ordersTitle": "Orders",
        "ordersLead": "Service orders and their payment status.",
        "colRef": "Order",
        "colCreated": "Created",
        "colEmail": "Email",
        "ordersSearch": "Search reference, email or company",
        "actionPaid": "Mark paid",
        "actionCancel": "Cancel",
        "actionRefund": "Refund",
        "empty": "No orders yet.",
        "updated": "Updated",
    },
    "zh": {
        "ordersTitle": "订单",
        "ordersLead": "服务订单及其付款状态。",
        "colRef": "订单号",
        "colCreated": "创建时间",
        "colEmail": "邮箱",
        "ordersSearch": "搜索订单号、邮箱或公司",
        "actionPaid": "标记已付款",
        "actionCancel": "取消",
        "actionRefund": "退款",
        "empty": "暂无订单。",
        "updated": "已更新",
    },
    "zh-TW": {
        "ordersTitle": "訂單",
        "ordersLead": "服務訂單及其付款狀態。",
        "colRef": "訂單編號",
        "colCreated": "建立時間",
        "colEmail": "信箱",
        "ordersSearch": "搜尋訂單編號、信箱或公司",
        "actionPaid": "標記已付款",
        "actionCancel": "取消",
        "actionRefund": "退款",
        "empty": "暫無訂單。",
        "updated": "已更新",
    },
}


def block(loc, real_map, fallback_map):
    """返回该语种应写入的键值：有真实译文用真实，否则用英文兜底。"""
    if loc in REAL:
        return dict(real_map[REAL[loc]])
    return dict(fallback_map["en"])


def main() -> int:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    report = []
    for loc in LOCALES:
        path = os.path.join(DICT_DIR, f"{loc}.json")
        shutil.copy2(path, os.path.join(BACKUP_DIR, f"{loc}.json"))

        with io.open(path, "r", encoding="utf-8", newline="") as f:
            data = json.loads(f.read())

        added = 0

        if "checkout" not in data or not isinstance(data.get("checkout"), dict):
            data["checkout"] = {}
        for k, v in block(loc, CHECKOUT, CHECKOUT).items():
            if k not in data["checkout"]:
                data["checkout"][k] = v
                added += 1

        if "order" not in data or not isinstance(data.get("order"), dict):
            data["order"] = {}
        for k, v in block(loc, ORDER, ORDER).items():
            if k not in data["order"]:
                data["order"][k] = v
                added += 1

        if "admin" not in data or not isinstance(data.get("admin"), dict):
            data["admin"] = {}
        if "orders" not in data["admin"] or not isinstance(data["admin"].get("orders"), dict):
            data["admin"]["orders"] = {}
        for k, v in block(loc, ADMIN_ORDERS, ADMIN_ORDERS).items():
            if k not in data["admin"]["orders"]:
                data["admin"]["orders"][k] = v
                added += 1

        if added:
            out = json.dumps(data, ensure_ascii=False, indent=2)
            out_crlf = out.replace("\r\n", "\n").replace("\n", "\r\n") + "\r\n"
            with io.open(path, "w", encoding="utf-8", newline="") as f:
                f.write(out_crlf)
        report.append(f"  {loc}: +{added} 键")

    print("[i18n] CS-17 字典补齐完成")
    for line in report:
        print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
