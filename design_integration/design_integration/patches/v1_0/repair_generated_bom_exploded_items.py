import frappe


def execute():
    from design_integration.design_integration.doctype.design_request_item.design_request_item import (
        repair_bom_exploded_items,
    )

    result = repair_bom_exploded_items(dry_run=0, only_generated=1)
    frappe.logger("design_integration").info(
        "Repaired generated BOM exploded items: checked %(bom_count)s BOMs, repaired %(repair_count)s BOMs",
        result,
    )
