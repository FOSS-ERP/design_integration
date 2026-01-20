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
        ]
    }

    create_custom_fields(fields)