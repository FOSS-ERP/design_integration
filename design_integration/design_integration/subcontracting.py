import json

import frappe
from frappe import _
from frappe.utils import flt


def sync_subcontract_raw_material_details(doc, method=None):
    if doc.doctype == "Purchase Order":
        _sync_purchase_order_raw_material_details(doc)
    elif doc.doctype == "Purchase Receipt":
        _sync_purchase_receipt_raw_material_details(doc)


def remove_subcontracting_receipt_scrap_value(doc, method=None):
    if doc.doctype != "Subcontracting Receipt":
        return

    ignored_scrap_references = _get_design_generated_sheet_scrap_references(doc)
    if not ignored_scrap_references:
        return

    _zero_scrap_item_values(doc, ignored_scrap_references)
    if hasattr(doc, "calculate_items_qty_and_amount"):
        doc.calculate_items_qty_and_amount()
        _zero_scrap_item_values(doc, ignored_scrap_references)


def _get_design_generated_sheet_scrap_references(doc):
    references = set()
    for row in doc.get("items", []) or []:
        if row.get("is_scrap_item") or not row.get("bom"):
            continue
        if _is_design_generated_sheet_bom(row.get("bom")):
            references.add(row.name)
    return references


def _is_design_generated_sheet_bom(bom_name):
    if not bom_name or not frappe.db.exists("BOM", bom_name):
        return False

    bom = frappe.get_doc("BOM", bom_name)
    if not bom.item or not bom.item.startswith("PRT"):
        return False
    if len(bom.get("items") or []) != 1 or len(bom.get("scrap_items") or []) != 1:
        return False

    material = bom.items[0]
    scrap = bom.scrap_items[0]
    return material.item_code == scrap.item_code and flt(scrap.stock_qty) == 1


def _zero_scrap_item_values(doc, ignored_scrap_references):
    for row in doc.get("items", []) or []:
        if row.get("is_scrap_item") and row.get("reference_name") in ignored_scrap_references:
            row.rate = 0
            row.amount = 0
            row.base_rate = 0
            row.base_amount = 0
            row.rm_cost_per_qty = 0
            row.service_cost_per_qty = 0
            row.additional_cost_per_qty = 0
            row.scrap_cost_per_qty = 0
        elif not row.get("is_scrap_item") and row.name in ignored_scrap_references:
            row.scrap_cost_per_qty = 0


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
