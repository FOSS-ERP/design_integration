import frappe
from frappe.utils import flt


def execute():
    if not frappe.get_meta("Design Request Item Child").has_field("design_request_item"):
        return

    updated_links = 0
    updated_descriptions = 0

    design_requests = frappe.get_all("Design Request", pluck="name")
    for design_request in design_requests:
        children = frappe.get_all(
            "Design Request Item Child",
            filters={
                "parent": design_request,
                "parenttype": "Design Request",
                "parentfield": "items",
            },
            fields=[
                "name",
                "idx",
                "item_code",
                "item_name",
                "description",
                "qty",
                "uom",
                "so_detail",
                "design_request_item",
            ],
            order_by="idx asc, name asc",
        )
        if not children:
            continue

        design_items = frappe.get_all(
            "Design Request Item",
            filters={"design_request": design_request},
            fields=["name", "item_code", "item_name", "description", "qty", "uom", "creation"],
            order_by="creation asc, name asc",
        )
        if not design_items:
            continue

        used_design_items = set()
        one_to_one_by_position = len(children) == len(design_items)

        for position, child in enumerate(children):
            design_item = _find_matching_design_item(
                child,
                design_items,
                used_design_items,
                design_items[position] if one_to_one_by_position else None,
            )
            if not design_item:
                continue

            used_design_items.add(design_item.name)

            if child.get("design_request_item") != design_item.name:
                frappe.db.set_value(
                    "Design Request Item Child",
                    child.name,
                    "design_request_item",
                    design_item.name,
                    update_modified=False,
                )
                updated_links += 1

            source_description = _get_child_source_description(child)
            if source_description and _can_replace_design_item_description(design_item):
                frappe.db.set_value(
                    "Design Request Item",
                    design_item.name,
                    "description",
                    source_description,
                    update_modified=False,
                )
                updated_descriptions += 1

    frappe.logger("design_integration").info(
        "Backfilled Design Request Item child links: %(updated_links)s links, %(updated_descriptions)s descriptions",
        {"updated_links": updated_links, "updated_descriptions": updated_descriptions},
    )


def _find_matching_design_item(child, design_items, used_design_items, positional_fallback=None):
    matches = []
    for design_item in design_items:
        if design_item.name in used_design_items:
            continue
        if design_item.item_code != child.item_code:
            continue
        if design_item.uom and child.uom and design_item.uom != child.uom:
            continue
        if design_item.qty is not None and child.qty is not None and flt(design_item.qty) != flt(child.qty):
            continue
        matches.append(design_item)

    if len(matches) == 1:
        return matches[0]

    if positional_fallback and positional_fallback.name not in used_design_items:
        if positional_fallback.item_code == child.item_code:
            return positional_fallback

    return None


def _get_child_source_description(child):
    description = (child.get("description") or "").strip()
    if description and not _is_item_master_description(child.item_code, description):
        return description

    so_detail = child.get("so_detail")
    if so_detail and frappe.db.exists("Sales Order Item", so_detail):
        return (frappe.db.get_value("Sales Order Item", so_detail, "description") or "").strip()

    return description


def _can_replace_design_item_description(design_item):
    description = (design_item.get("description") or "").strip()
    if not description:
        return True
    if description == (design_item.get("item_name") or "").strip():
        return True
    return _is_item_master_description(design_item.item_code, description)


def _is_item_master_description(item_code, description):
    if not item_code or not description or not frappe.db.exists("Item", item_code):
        return False

    item_description = (frappe.db.get_value("Item", item_code, "description") or "").strip()
    item_name = (frappe.db.get_value("Item", item_code, "item_name") or "").strip()
    return description in {item_description, item_name}
