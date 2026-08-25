import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime

class DesignRequestItemChild(Document):
    def validate(self):
        """Validate Design Request Item Child"""
        self.validate_item()
        self.update_current_stage()
    
    def on_update(self):
        """Handle updates"""
        self.handle_approval_status_change()
        self.log_stage_transition()
        self.handle_field_dependencies()
    
    def validate_item(self):
        """Validate and populate item details"""
        if self.item_code:
            try:
                item = frappe.get_doc("Item", self.item_code)
                self.item_name = item.item_name
                if not self.description:
                    self.description = item.description or ""
            except:
                frappe.throw(_("Item {0} not found").format(self.item_code))
    
    def update_current_stage(self):
        """Update current stage based on design status"""
        self.current_stage = self.design_status
    
    def handle_approval_status_change(self):
        """Handle approval status changes"""
        if self.has_value_changed("approval_status"):
            if self.approval_status == "Approved":
                self.design_status = "Design"
                self.approval_date = now_datetime()
            elif self.approval_status in ["Rejected", "On Hold"]:
                self.design_status = "On Hold"
                self.approval_date = now_datetime()
    
    def log_stage_transition(self):
        """Log stage transitions"""
        if self.has_value_changed("design_status"):
            transition = {
                "stage": "design_status",
                "from_status": self.get_doc_before_save().design_status if self.get_doc_before_save() else "",
                "to_status": self.design_status,
                "transition_date": now_datetime(),
                "transitioned_by": frappe.session.user,
                "remarks": f"Status changed to {self.design_status}"
            }
            
            if not self.stage_transition_log:
                self.stage_transition_log = []
            
            self.stage_transition_log.append(transition)
    
    def handle_field_dependencies(self):
        """Handle automatic field updates based on dependencies"""
        # Handle new_item_code changes
        if self.has_value_changed("new_item_code") and self.new_item_code:
            self.sku_generated = 1
            self.item_created = 1
            
            # Fetch item name from the selected item
            try:
                item_doc = frappe.get_doc("Item", self.new_item_code)
                self.new_item_name = item_doc.item_name
            except:
                self.new_item_name = ""
            
            frappe.msgprint(_("SKU Generated and Item Created automatically set to Yes."))
        
        # Handle bom_name changes
        if self.has_value_changed("bom_name") and self.bom_name:
            self.bom_created = 1
            frappe.msgprint(_("BOM Created automatically set to Yes."))
        
        # Handle nesting completion
        if self.design_status == "Nesting":
            self.nesting_completed = 1 
