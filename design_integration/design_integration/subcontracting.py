import json

import frappe
from frappe import _
from frappe.utils import flt


def sync_subcontract_raw_material_details(doc, method=None):
    if doc.doctype == "Purchase Order":
        _sync_purchase_order_raw_material_details(doc)
    elif doc.doctype == "Purchase Receipt":
        _sync_purchase_receipt_raw_material_details(doc)


def _sync_purchase_order_raw_material_details(doc):
    if not doc.get("is_subcontracted"):
        return

    for row in doc.get("items", []):
        fg_item = row.get("fg_item") or row.get("custom_fg_item")
        fg_qty = flt(row.get("fg_item_qty")) or flt(row.get("qty"))
        if not fg_item or fg_qty <= 0:
            _set_row_subcontract_rm_details(row, None, 0, [])
            continue

        bom = row.get("bom") or frappe.db.get_value("Item", fg_item, "default_bom")
        materials = get_subcontract_raw_materials(fg_item, bom, fg_qty, row.get("include_exploded_items"))
        _set_row_subcontract_rm_details(row, fg_item, fg_qty, materials)


def _sync_purchase_receipt_raw_material_details(doc):
    if not doc.get("is_subcontracted"):
        return

    for row in doc.get("items", []):
        fg_item = row.get("custom_fg_item")
        fg_qty = flt(row.get("qty"))

        if row.get("purchase_order_item"):
            po_values = frappe.db.get_value(
                "Purchase Order Item",
                row.get("purchase_order_item"),
                [
                    "fg_item",
                    "fg_item_qty",
                    "qty",
                    "custom_fg_item",
                    "custom_fg_item_qty",
                    "custom_subcontract_raw_materials",
                ],
                as_dict=True,
            )
            if po_values:
                fg_item = po_values.get("fg_item") or po_values.get("custom_fg_item") or fg_item
                po_fg_qty = flt(po_values.get("fg_item_qty")) or flt(po_values.get("custom_fg_item_qty"))
                po_service_qty = flt(po_values.get("qty"))
                if po_fg_qty and po_service_qty and flt(row.get("qty")):
                    fg_qty = flt(row.get("qty")) * po_fg_qty / po_service_qty
                else:
                    fg_qty = flt(row.get("qty")) or po_fg_qty

        if not fg_item or fg_qty <= 0:
            _set_row_subcontract_rm_details(row, None, 0, [])
            continue

        bom = row.get("bom") or frappe.db.get_value("Item", fg_item, "default_bom")
        materials = get_subcontract_raw_materials(fg_item, bom, fg_qty, row.get("include_exploded_items"))
        _set_row_subcontract_rm_details(row, fg_item, fg_qty, materials)


def _set_row_subcontract_rm_details(row, fg_item, fg_qty, materials):
    if _has_field(row, "custom_fg_item"):
        row.custom_fg_item = fg_item
    if _has_field(row, "custom_fg_item_qty"):
        row.custom_fg_item_qty = fg_qty
    if _has_field(row, "custom_subcontract_raw_materials"):
        row.custom_subcontract_raw_materials = json.dumps(materials, separators=(",", ":")) if materials else ""


def _has_field(row, fieldname):
    return bool(getattr(row, "meta", None) and row.meta.has_field(fieldname))


@frappe.whitelist()
def get_subcontract_raw_materials(fg_item, bom=None, qty=1, include_exploded_items=1):
    if not fg_item:
        return []

    bom = bom or frappe.db.get_value("Item", fg_item, "default_bom")
    if not bom:
        return []

    if not frappe.db.exists("BOM", bom):
        frappe.throw(_("BOM {0} was not found.").format(bom))

    qty = flt(qty) or 1
    doctype = "BOM Explosion Item" if flt(include_exploded_items) else "BOM Item"

    fields = [
        f"`tab{doctype}`.`item_code` as item_code",
        f"`tab{doctype}`.`item_name` as item_name",
        f"`tab{doctype}`.`description` as description",
        f"`tab{doctype}`.`stock_uom` as stock_uom",
        f"`tab{doctype}`.`stock_qty` as stock_qty",
        f"`tab{doctype}`.`stock_qty` / `tabBOM`.`quantity` as qty_consumed_per_unit",
    ]
    filters = [
        [doctype, "parent", "=", bom],
        [doctype, "docstatus", "=", 1],
        ["BOM", "item", "=", fg_item],
        [doctype, "sourced_by_supplier", "=", 0],
    ]
    rows = frappe.get_all(
        "BOM",
        fields=fields,
        filters=filters,
        order_by=f"`tab{doctype}`.`idx` asc",
    )

    materials_by_item = {}
    for row in rows:
        item_code = row.get("item_code")
        if not item_code:
            continue
        qty_per_unit = flt(row.get("qty_consumed_per_unit"))
        required_qty = qty_per_unit * qty
        if required_qty <= 0:
            continue

        if item_code not in materials_by_item:
            materials_by_item[item_code] = {
                "item_code": item_code,
                "item_name": row.get("item_name"),
                "description": row.get("description"),
                "stock_uom": row.get("stock_uom"),
                "qty_per_unit": 0,
                "qty": 0,
            }

        materials_by_item[item_code]["qty_per_unit"] += qty_per_unit
        materials_by_item[item_code]["qty"] += required_qty

    return list(materials_by_item.values())
