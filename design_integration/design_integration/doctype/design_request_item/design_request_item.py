import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime
from frappe.utils import getdate
from frappe.utils import now_datetime
import frappe.model.naming

class DesignRequestItem(Document):
    def autoname(self):
        """Generate name for Design Request Item"""
        if not self.name:
            # Get the next number in the series
            last_item = frappe.get_all(
                "Design Request Item",
                fields=["name"],
                order_by="name desc",
                limit=1
            )
            
            if last_item:
                try:
                    last_number = int(last_item[0].name.split('-')[-1])
                    next_number = last_number + 1
                except:
                    next_number = 1
            else:
                next_number = 1
            
            self.name = f"DES-IT-{next_number:06d}"
    
    def validate(self):
        """Validate Design Request Item"""
        self.validate_item()
        self.update_current_stage()
        self.create_work_order()
    
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
                self.description = item.description or ""
            except:
                frappe.throw(_("Item {0} not found").format(self.item_code))
    
    def update_current_stage(self):
        """Update current stage based on design status"""
        self.current_stage = self.design_status
    
    def handle_approval_status_change(self):
        """Handle approval status changes"""
        if self.has_value_changed("approval_status"):
            # If a revision is being requested explicitly
            if self.approval_status == "Revised":
                # Mark revision flag; keep current design_status unchanged
                self.revision_requested = 1
                self.approval_date = now_datetime()
                # Log revision request in stage transition log
                try:
                    self.append("stage_transition_log", {
                        "stage": "revision",
                        "from_status": self.get_doc_before_save().design_status if self.get_doc_before_save() else self.design_status,
                        "to_status": self.design_status,
                        "transition_date": now_datetime(),
                        "transitioned_by": frappe.session.user,
                        "remarks": f"Revision requested: {getattr(self, 'revision_reason', '') or ''}"
                    })
                except Exception:
                    pass
                return
            
            if self.approval_status == "Approved":
                self.approval_date = now_datetime()
                # If there is an active revision request, only Planning User or System Manager can approve
                if getattr(self, "revision_requested", 0):
                    user_roles = set(frappe.get_roles())
                    allowed_roles = {"Planning User", "System Manager"}
                    if not (user_roles & allowed_roles):
                        frappe.throw(_("Only Planning User or System Manager can approve a revision request."))
                    # Revision approved: send item back to Modelling and increment count
                    self.design_status = "Modelling"
                    try:
                        self.revision_count = (self.revision_count or 0) + 1
                    except Exception:
                        self.revision_count = 1
                    self.revision_requested = 0
                else:
                    # Normal approval flow
                    self.design_status = "Design"
            elif self.approval_status == "Rejected":
                # Send back to Approval Drawing; no On Hold state in design_status
                self.design_status = "Approval Drawing"
                self.approval_date = now_datetime()
            elif self.approval_status == "On Hold":
                # Do not change design_status; only approval_status reflects hold
                self.approval_date = now_datetime()
    
    def log_stage_transition(self):
        """Log stage transitions (store as child rows, not raw dicts)"""
        if self.is_new():
            # don't log on first insert
            return
        if self.has_value_changed("design_status"):
            # set timing fields for Gantt
            if not self.start_date and self.design_status and self.design_status != "Pending":
                self.start_date = now_datetime()
            if self.design_status == "Completed" and not self.completion_date:
                self.completion_date = now_datetime()
            self.append("stage_transition_log", {
                "stage": "design_status",
                "from_status": self.get_doc_before_save().design_status if self.get_doc_before_save() else "",
                "to_status": self.design_status,
                "transition_date": now_datetime(),
                "transitioned_by": frappe.session.user,
                "remarks": f"Status changed to {self.design_status}"
            })
    
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
        
    def create_work_order(self):
        if frappe.db.exists("Work Order", {"design_request_item" : self.name}):
            return
        if self.design_status == "Completed" and self.bom_name:
            variant_of = None
            if variant_of := frappe.db.get_value("Item",self.new_item_code ,"variant_of"):
                variant_of = variant_of
            from erpnext.manufacturing.doctype.work_order.work_order import make_work_order
            wo_doc = make_work_order(
                self.bom_name,
                self.new_item_code,
                self.qty or 1,
                variant_items = variant_of,
                use_multi_level_bom=1
            )
            wo_doc.design_request_item = self.name
            if self.design_request:
                wo_doc.sales_order = frappe.db.get_value("Design Request", self.design_request, "sales_order")
            wo_doc.save(ignore_permissions=True)
            
@frappe.whitelist()
def update_design_status(docname, new_status):
    """Update design status from list view"""
    try:
        doc = frappe.get_doc("Design Request Item", docname)
        doc.design_status = new_status
        doc.save()
        return {"success": True}
    except Exception as e:
        frappe.log_error(f"Error updating design status: {str(e)}")
        return {"success": False, "error": str(e)}




def update_approval_status(docname, new_status):
    """Update approval status from list view"""
    try:
        doc = frappe.get_doc("Design Request Item", docname)
        doc.approval_status = new_status
        doc.save()
        return {"success": True}
    except Exception as e:
        frappe.log_error(f"Error updating approval status: {str(e)}")
        return {"success": False, "error": str(e)} 

@frappe.whitelist()
def get_version_meta_data():
    return frappe.get_meta("Design Version")


@frappe.whitelist()
def get_version_list(design_request_item):
    return frappe.get_all("Design Version", filters={"design_request_item" : design_request_item}, fields=[
        "name", "posting_date", "version_tag", "new_version_file", "description"
    ])



@frappe.whitelist()
def delete_version(version_name, design_request_item):
    """Delete a design version"""
    try:
        # Check permissions
        if not frappe.has_permission("Design Version", "delete"):
            frappe.throw(_("You don't have permission to delete versions"))
        
        # Get the version
        version = frappe.get_doc("Design Version", version_name)
        
        # Store reference before deleting
        docname = version.name
        
        # Delete the document
        frappe.delete_doc("Design Version", version_name, ignore_permissions=False)
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": _("Version deleted successfully"),
            "deleted_docname": docname
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Design Version Deletion Error")
        frappe.throw(_("Error deleting version: {0}").format(str(e)))