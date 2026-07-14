import frappe
from frappe import _
from frappe.model.document import Document


class DesignBOMItemMapping(Document):
    def validate(self):
        if self.sheet_metal_thickness:
            self.sheet_metal_thickness = str(self.sheet_metal_thickness).strip()
        if self.sheet_description:
            self.sheet_description = self.sheet_description.strip()
        if self.material:
            self.material = self.material.strip()
        if not frappe.db.exists("Item", self.erp_item):
            frappe.throw(_("ERP Item {0} does not exist.").format(self.erp_item))
