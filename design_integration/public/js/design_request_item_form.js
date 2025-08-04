// Custom Design Request Item Form with 2-Column Layout
frappe.ui.form.on("Design Request Item", {
    refresh: function(frm) {
        // Beautify the form layout with 2-column structure
        frm.set_df_property("item_code", "bold", 1);
        frm.set_df_property("item_name", "bold", 1);
        
        // Add section breaks for 2-column layout
        if (!frm.get_field("section_break_1")) {
            frm.add_section_break("section_break_1", "Item Details");
        }
        if (!frm.get_field("column_break_1")) {
            frm.add_column_break("column_break_1");
        }
        if (!frm.get_field("section_break_2")) {
            frm.add_section_break("section_break_2", "Design Status & Approval");
        }
        if (!frm.get_field("column_break_2")) {
            frm.add_column_break("column_break_2");
        }
        if (!frm.get_field("section_break_3")) {
            frm.add_section_break("section_break_3", "Final Item & BOM");
        }
        if (!frm.get_field("column_break_3")) {
            frm.add_column_break("column_break_3");
        }
        if (!frm.get_field("section_break_4")) {
            frm.add_section_break("section_break_4", "Stage Transition Log");
        }
        
        // Add custom buttons
        if (frm.doc.docstatus === 0) {
            frm.add_custom_button(__("Update Status"), () => {
                frm.events.show_status_dialog(frm);
            }, __("Actions"));
            
            frm.add_custom_button(__("Assign To"), () => {
                frm.events.show_assign_dialog(frm);
            }, __("Actions"));
            
            frm.add_custom_button(__("Add Approval Remarks"), () => {
                frm.events.show_approval_remarks_dialog(frm);
            }, __("Actions"));
        }
        
        // Add status indicator
        if (frm.doc.design_status) {
            let status_color = frm.events.get_status_color(frm.doc.design_status);
            frm.dashboard.add_indicator(__("Status: {0}", [frm.doc.design_status]), status_color);
        }
        
        if (frm.doc.approval_status) {
            let approval_color = frm.events.get_approval_color(frm.doc.approval_status);
            frm.dashboard.add_indicator(__("Approval: {0}", [frm.doc.approval_status]), approval_color);
        }
    },
    
    design_status: function(frm) {
        // Update current stage when design status changes
        frm.set_value("current_stage", frm.doc.design_status);
        
        // Show status change notification
        if (frm.doc.design_status) {
            frappe.show_alert({
                message: __("Status changed to: {0}", [frm.doc.design_status]),
                indicator: "green"
            }, 3);
        }
    },
    
    approval_status: function(frm) {
        // Handle approval status changes with confirmation
        if (frm.doc.approval_status === "Approved") {
            frappe.confirm(
                __("Are you sure you want to approve this item? This will automatically change the Design Status to 'Design'."),
                function() {
                    frm.set_value("design_status", "Design");
                    frm.set_value("approval_date", frappe.datetime.now_datetime());
                    frappe.msgprint({
                        message: __("Item approved successfully. Design Status changed to 'Design'."),
                        indicator: "green"
                    });
                },
                function() {
                    frm.set_value("approval_status", frm.doc.approval_status);
                }
            );
        } else if (frm.doc.approval_status === "Rejected") {
            frappe.confirm(
                __("Are you sure you want to reject this item? This will automatically change the Design Status to 'On Hold'."),
                function() {
                    frm.set_value("design_status", "On Hold");
                    frappe.msgprint({
                        message: __("Item rejected. Design Status changed to 'On Hold'."),
                        indicator: "orange"
                    });
                },
                function() {
                    frm.set_value("approval_status", frm.doc.approval_status);
                }
            );
        }
    },
    
    new_item_code: function(frm) {
        // Auto-update SKU and Item Created when new item is selected
        if (frm.doc.new_item_code) {
            frm.set_value("sku_generated", 1);
            frm.set_value("item_created", 1);
            
            // Fetch item name from the selected item
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Item',
                    name: frm.doc.new_item_code
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value("new_item_name", r.message.item_name);
                    }
                }
            });
            
            frappe.msgprint({
                message: __("SKU Generated and Item Created automatically set to Yes."),
                indicator: "green"
            });
        } else {
            // Clear the fields if new_item_code is cleared
            frm.set_value("sku_generated", 0);
            frm.set_value("item_created", 0);
            frm.set_value("new_item_name", "");
        }
    },
    
    bom_name: function(frm) {
        // Auto-update BOM Created when BOM is selected
        if (frm.doc.bom_name) {
            frm.set_value("bom_created", 1);
            frappe.msgprint({
                message: __("BOM Created automatically set to Yes."),
                indicator: "green"
            });
        }
    },
    
    show_status_dialog: function(frm) {
        let d = new frappe.ui.Dialog({
            title: __("Update Design Status"),
            fields: [
                {
                    fieldtype: "Select",
                    fieldname: "new_status",
                    label: __("New Status"),
                    options: "Pending\nApproval Drawing\nSend for Approval\nDesign\nModelling\nProduction Drawing\nSKU Generation\nBOM\nNesting\nCompleted\nCancelled",
                    default: frm.doc.design_status
                },
                {
                    fieldtype: "Text Editor",
                    fieldname: "status_remarks",
                    label: __("Status Remarks"),
                    reqd: 1
                }
            ],
            primary_action: function() {
                let new_status = d.fields_dict.new_status.value;
                let remarks = d.fields_dict.status_remarks.value;
                
                frm.set_value("design_status", new_status);
                frm.set_value("approval_remarks", remarks);
                
                frappe.msgprint({
                    message: __("Status updated successfully"),
                    indicator: "green"
                });
                
                d.hide();
            },
            primary_action_label: __("Update Status")
        });
        d.show();
    },
    
    show_assign_dialog: function(frm) {
        let d = new frappe.ui.Dialog({
            title: __("Assign Design Request Item"),
            fields: [
                {
                    fieldtype: "Link",
                    fieldname: "assigned_to",
                    label: __("Assign To"),
                    options: "User",
                    default: frm.doc.assigned_to
                },
                {
                    fieldtype: "Text Editor",
                    fieldname: "assignment_remarks",
                    label: __("Assignment Remarks")
                }
            ],
            primary_action: function() {
                let assigned_to = d.fields_dict.assigned_to.value;
                let remarks = d.fields_dict.assignment_remarks.value;
                
                frm.set_value("assigned_to", assigned_to);
                if (remarks) {
                    frm.set_value("approval_remarks", remarks);
                }
                
                frappe.msgprint({
                    message: __("Item assigned successfully"),
                    indicator: "green"
                });
                
                d.hide();
            },
            primary_action_label: __("Assign")
        });
        d.show();
    },
    
    show_approval_remarks_dialog: function(frm) {
        let d = new frappe.ui.Dialog({
            title: __("Add Approval Remarks"),
            fields: [
                {
                    fieldtype: "Text Editor",
                    fieldname: "new_approval_remarks",
                    label: __("Approval Remarks"),
                    reqd: 1
                }
            ],
            primary_action: function() {
                let remarks = d.fields_dict.new_approval_remarks.value;
                
                // Append to existing approval remarks
                let current_remarks = frm.doc.approval_remarks || "";
                let new_remarks = current_remarks + (current_remarks ? "\n\n" : "") + remarks;
                
                frm.set_value("approval_remarks", new_remarks);
                
                frappe.msgprint({
                    message: __("Approval remarks added successfully"),
                    indicator: "green"
                });
                
                d.hide();
            },
            primary_action_label: __("Add Remarks")
        });
        d.show();
    },
    
    get_status_color: function(status) {
        let colors = {
            'Pending': 'orange',
            'Approval Drawing': 'yellow',
            'Send for Approval': 'blue',
            'Design': 'purple',
            'Modelling': 'indigo',
            'Production Drawing': 'pink',
            'SKU Generation': 'cyan',
            'BOM': 'green',
            'Nesting': 'dark',
            'Completed': 'green',
            'Cancelled': 'red'
        };
        return colors[status] || 'gray';
    },
    
    get_approval_color: function(status) {
        let colors = {
            'Pending': 'orange',
            'Approved': 'green',
            'Rejected': 'red',
            'On Hold': 'yellow',
            'Revised': 'blue'
        };
        return colors[status] || 'gray';
    }
}); 