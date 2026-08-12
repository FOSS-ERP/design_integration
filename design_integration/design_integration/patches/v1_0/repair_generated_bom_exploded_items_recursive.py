import frappe


def execute():
    from design_integration.design_integration.doctype.design_request_item.design_request_item import (
        repair_bom_exploded_items,
    )

    result = repair_bom_exploded_items(dry_run=0, only_generated=1, repeat_until_clean=1)
    frappe.logger("design_integration").info(
        (
            "Repaired mismatched generated BOM exploded items using recursive BOM item calculation: "
            "checked %(bom_count)s BOMs, repaired %(repair_count)s BOMs"
        ),
        result,
    )
