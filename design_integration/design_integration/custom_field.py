import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def create_custom_fields_on_migrate():
    fields = {
        "Design Request Item Child" : [
            {
                "insert_after" : "approval_date",
                "fieldname" : "so_detail",
                "label" : "Against Sales Order Item",
                "fieldtype" : "Data",
                "hidden": 1
            }
        ],
        "Work Order" : [
            {
                "fieldname" : "design_request_item",
                "label" : "Design Request Item",
                "fieldtype" : "Link",
                "options" : "Design Request Item",
                "insert_after" : "project",
                "read_only": 1
            }
        ],
        "Design Request Item": [
            {
                "fieldname": "custom_bom_import_status",
                "label": "BOM Import Status",
                "fieldtype": "Select",
                "options": "Not Started\nValidation Failed\nProcessing\nCompleted\nFailed",
                "default": "Not Started",
                "insert_after": "custom_bom_importer",
                "read_only": 1,
            },
            {
                "fieldname": "custom_bom_import_log",
                "label": "BOM Import Log",
                "fieldtype": "Long Text",
                "insert_after": "custom_bom_import_status",
                "read_only": 1,
            },
        ]
    }

    create_custom_fields(fields)
