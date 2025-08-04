import frappe
from frappe import _
from frappe.model.document import Document

class DesignItemsDashboard(Document):
    pass

@frappe.whitelist()
def get_dashboard_data():
    """Get data for the design items dashboard"""
    try:
        # Get all design items with filters
        items = frappe.call(
            "design_integration.design_integration.doctype.design_request.design_request.get_all_design_items"
        )
        
        # Get statistics
        stats = frappe.call(
            "design_integration.design_integration.doctype.design_request.design_request.get_dashboard_stats"
        )
        
        return {
            "items": items,
            "stats": stats
        }
        
    except Exception as e:
        frappe.log_error(f"Failed to get dashboard data: {str(e)}")
        frappe.throw(f"Failed to get dashboard data: {str(e)}")

@frappe.whitelist()
def update_item_status_from_dashboard(item_id, new_status):
    """Update item status from dashboard"""
    try:
        return frappe.call(
            "design_integration.design_integration.doctype.design_request.design_request.update_item_status",
            item_id=item_id,
            new_status=new_status
        )
    except Exception as e:
        frappe.log_error(f"Failed to update item status from dashboard: {str(e)}")
        frappe.throw(f"Failed to update item status: {str(e)}") 