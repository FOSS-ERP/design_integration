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
        "Purchase Order": [
            {
                "fieldname": "custom_subcontract_service_section",
                "label": "Subcontract Service Item Update",
                "fieldtype": "Section Break",
                "insert_after": "scan_barcode",
                "depends_on": "eval:doc.is_subcontracted",
            },
            {
                "fieldname": "custom_subcontract_service_item",
                "label": "Item Code",
                "fieldtype": "Link",
                "options": "Item",
                "insert_after": "custom_subcontract_service_section",
            },
            {
                "fieldname": "custom_subcontract_service_column",
                "fieldtype": "Column Break",
                "insert_after": "custom_subcontract_service_item",
            },
            {
                "fieldname": "custom_subcontract_service_rate",
                "label": "Rate",
                "fieldtype": "Currency",
                "insert_after": "custom_subcontract_service_column",
            },
            {
                "fieldname": "custom_apply_subcontract_service",
                "label": "Apply",
                "fieldtype": "Button",
                "insert_after": "custom_subcontract_service_rate",
            },
            {
                "fieldname": "custom_subcontract_rm_summary",
                "label": "Raw Materials",
                "fieldtype": "HTML",
                "insert_after": "custom_apply_subcontract_service",
                "depends_on": "eval:doc.is_subcontracted",
            },
        ],
        "Purchase Order Item": [
            {
                "fieldname": "custom_fg_item",
                "label": "FG Item",
                "fieldtype": "Link",
                "options": "Item",
                "insert_after": "fg_item_qty",
                "read_only": 1,
                "depends_on": "eval:parent.is_subcontracted",
            },
            {
                "fieldname": "custom_fg_item_qty",
                "label": "FG Qty",
                "fieldtype": "Float",
                "insert_after": "custom_fg_item",
                "read_only": 1,
                "depends_on": "eval:parent.is_subcontracted",
            },
            {
                "fieldname": "custom_subcontract_raw_materials",
                "label": "Raw Materials",
                "fieldtype": "Long Text",
                "insert_after": "custom_fg_item_qty",
                "read_only": 1,
                "depends_on": "eval:parent.is_subcontracted",
            },
        ],
        "Purchase Receipt": [
            {
                "fieldname": "custom_subcontract_rm_rate_section",
                "label": "Subcontract Raw Material Amount Summary",
                "fieldtype": "Section Break",
                "insert_after": "scan_barcode",
                "depends_on": "eval:doc.is_subcontracted",
            },
            {
                "fieldname": "custom_subcontract_rm_rate_summary",
                "label": "Raw Material Amount Summary",
                "fieldtype": "HTML",
                "insert_after": "custom_subcontract_rm_rate_section",
                "depends_on": "eval:doc.is_subcontracted",
            },
            {
                "fieldname": "custom_apply_subcontract_rm_rates",
                "label": "Apply RM Amounts",
                "fieldtype": "Button",
                "insert_after": "custom_subcontract_rm_rate_summary",
                "depends_on": "eval:doc.is_subcontracted",
            },
        ],
        "Purchase Receipt Item": [
            {
                "fieldname": "custom_fg_item",
                "label": "FG Item",
                "fieldtype": "Link",
                "options": "Item",
                "insert_after": "bom",
                "read_only": 1,
                "depends_on": "eval:parent.is_subcontracted",
            },
            {
                "fieldname": "custom_fg_item_qty",
                "label": "FG Qty",
                "fieldtype": "Float",
                "insert_after": "custom_fg_item",
                "read_only": 1,
                "depends_on": "eval:parent.is_subcontracted",
            },
            {
                "fieldname": "custom_subcontract_raw_materials",
                "label": "Raw Materials",
                "fieldtype": "Long Text",
                "insert_after": "custom_fg_item_qty",
                "read_only": 1,
                "depends_on": "eval:parent.is_subcontracted",
            },
        ],
        "Production Plan": [
            {
                "fieldname": "custom_sub_assembly_filter_section",
                "label": "Sub Assembly Filters",
                "fieldtype": "Section Break",
                "insert_after": "section_break_24",
            },
            {
                "fieldname": "custom_sub_assembly_item_name_filter",
                "label": "Item Name",
                "fieldtype": "Data",
                "insert_after": "custom_sub_assembly_filter_section",
            },
            {
                "fieldname": "custom_sub_assembly_filter_column",
                "fieldtype": "Column Break",
                "insert_after": "custom_sub_assembly_item_name_filter",
            },
            {
                "fieldname": "custom_sub_assembly_manufacturing_type",
                "label": "Manufacturing Type",
                "fieldtype": "Select",
                "options": "\nIn House\nSubcontract\nMaterial Request",
                "insert_after": "custom_sub_assembly_filter_column",
            },
            {
                "fieldname": "custom_sub_assembly_supplier",
                "label": "Supplier",
                "fieldtype": "Link",
                "options": "Supplier",
                "insert_after": "custom_sub_assembly_manufacturing_type",
                "depends_on": "eval:doc.custom_sub_assembly_manufacturing_type == 'Subcontract'",
            },
            {
                "fieldname": "custom_apply_sub_assembly_updates",
                "label": "Apply",
                "fieldtype": "Button",
                "insert_after": "custom_sub_assembly_supplier",
            },
        ],
        "Stock Entry": [
            {
                "fieldname": "custom_subcontract_summary_section",
                "label": "Subcontract Item Summary",
                "fieldtype": "Section Break",
                "insert_after": "scan_barcode",
                "depends_on": "eval:doc.purpose == 'Send to Subcontractor'",
            },
            {
                "fieldname": "custom_subcontract_item_summary",
                "label": "Item Summary",
                "fieldtype": "HTML",
                "insert_after": "custom_subcontract_summary_section",
            },
            {
                "fieldname": "custom_apply_subcontract_item_summary",
                "label": "Make Changes",
                "fieldtype": "Button",
                "insert_after": "custom_subcontract_item_summary",
                "depends_on": "eval:doc.purpose == 'Send to Subcontractor'",
            },
        ],
        "Design Request Item": [
            {
                "fieldname": "custom_bom_importer",
                "label": "BOM Import Sheet",
                "fieldtype": "Attach",
                "insert_after": "bom_created",
                "depends_on": "eval:doc.design_status == 'BOM'",
            },
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
            {
                "fieldname": "custom_generated_sku_barcodes",
                "label": "Generated SKU Barcodes",
                "fieldtype": "Long Text",
                "insert_after": "custom_bom_import_log",
                "read_only": 1,
            },
            {
                "fieldname": "custom_generated_sku_barcode_sheet",
                "label": "Generated SKU Barcode Sheet",
                "fieldtype": "Attach",
                "insert_after": "custom_generated_sku_barcodes",
                "read_only": 1,
            },
        ]
    }

    create_custom_fields(fields)
