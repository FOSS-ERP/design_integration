import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime

class DesignRequestItem(Document):
    def autoname(self):
        """Auto-generate name using simple numbering"""
        # Generate a simple numerical name
        from frappe.model.naming import make_autoname
        
        # Use a simple pattern for design request items
        self.name = make_autoname("DES-ITE-.YYYY.-.#####")
    
    def validate(self):
        """Validate the design request item"""
        self.update_current_stage()
        self.handle_field_dependencies()
    
    def on_update(self):
        """Handle updates to the design request item"""
        self.handle_approval_status_change()
        self.log_stage_transition()
        self.handle_field_dependencies()
    
    def update_current_stage(self):
        """Update the current stage field based on design status"""
        if self.design_status:
            self.current_stage = self.design_status
    
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
    
    def handle_approval_status_change(self):
        """Handle approval status changes"""
        if self.has_value_changed("approval_status"):
            if self.approval_status == "Approved":
                # Change design status to Design when approved
                if self.design_status in ["Approval Drawing", "Send for Approval"]:
                    self.design_status = "Design"
                    frappe.msgprint(_("Design Status automatically changed to 'Design' as approval was granted."))
                
                # Set approval date
                self.approval_date = now_datetime()
                
            elif self.approval_status == "Rejected":
                # Change design status to On Hold when rejected
                self.design_status = "On Hold"
                frappe.msgprint(_("Design Status automatically changed to 'On Hold' as approval was rejected."))
    
    def log_stage_transition(self):
        """Log stage transitions for tracking"""
        if self.has_value_changed("design_status"):
            # Add to stage transition log
            if not hasattr(self, 'stage_transition_log') or not self.stage_transition_log:
                self.stage_transition_log = []
            
            from_status = ""
            if self.get_doc_before_save():
                from_status = self.get_doc_before_save().design_status or ""
            
            self.append("stage_transition_log", {
                "stage": self.design_status,
                "from_status": from_status,
                "to_status": self.design_status,
                "transition_date": now_datetime(),
                "transitioned_by": frappe.session.user,
                "remarks": f"Status changed from {from_status} to {self.design_status}"
            })
    
    def on_trash(self):
        """Handle deletion of design request item"""
        # You can add any cleanup logic here
        pass 