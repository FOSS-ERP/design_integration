// Design Integration Client Scripts

// Sales Order Form - Add Design Request Button
frappe.ui.form.on("Sales Order", {
    refresh: function(frm) {
        console.log("Sales Order refresh called", frm.doc.docstatus, frm.has_perm("write"));
        
        if (frm.doc.docstatus === 1 && frm.has_perm("write")) {
            console.log("Adding Design Request button");
            // Add Design Request button after Work Order button
            if (frappe.model.can_create("Design Request")) {
                frm.add_custom_button(
                    __("Design Request"),
                    function() {
                        console.log("Design Request button clicked");
                        make_design_request(frm);
                    },
                    __("Create")
                );
                console.log("Design Request button added");
            } else {
                console.log("Cannot create Design Request");
            }
        } else {
            console.log("Conditions not met for Design Request button");
        }
    }
});

function make_design_request(frm) {
    console.log("make_design_request function called");
    
    var me = this;
    frm.call({
        method: "design_integration.design_integration.doctype.design_request.design_request.get_design_request_items",
        args: {
            sales_order: frm.docname,
        },
        freeze: true,
        callback: function(r) {
            console.log("Server response:", r);
            if (!r.message) {
                frappe.msgprint({
                    title: __("Design Request not created"),
                    message: __("No items found in this Sales Order"),
                    indicator: "orange",
                });
                return;
            } else {
                const fields = [
                    {
                        label: __("Items"),
                        fieldtype: "Table",
                        fieldname: "items",
                        description: __("Select items for design work"),
                        fields: [
                            {
                                fieldtype: "Read Only",
                                fieldname: "idx",
                                label: __("S.No"),
                                in_list_view: 1,
                                width: 60
                            },
                            {
                                fieldtype: "Read Only",
                                fieldname: "item_code",
                                label: __("Item Code"),
                                in_list_view: 1,
                                width: 150
                            },
                            {
                                fieldtype: "Read Only",
                                fieldname: "item_name",
                                label: __("Item Name"),
                                in_list_view: 1,
                                width: 200
                            },
                            {
                                fieldtype: "Read Only",
                                fieldname: "description",
                                label: __("Description"),
                                in_list_view: 1,
                                width: 250
                            },
                            {
                                fieldtype: "Read Only",
                                fieldname: "qty",
                                label: __("Qty"),
                                in_list_view: 1,
                                width: 80
                            },
                            {
                                fieldtype: "Read Only",
                                fieldname: "uom",
                                label: __("UOM"),
                                in_list_view: 1,
                                width: 80
                            },
                            {
                                fieldtype: "Data",
                                fieldname: "sales_order_item",
                                label: __("Sales Order Item"),
                                hidden: 1,
                            },
                        ],
                        data: r.message,
                        get_data: () => {
                            return r.message;
                        },
                    },
                ];
                
                console.log("Creating dialog with fields:", fields);
                
                var d = new frappe.ui.Dialog({
                    title: __("Select Items for Design Request"),
                    fields: fields,
                    primary_action: function() {
                        console.log("Primary action called");
                        var data = { items: d.fields_dict.items.grid.get_selected_children() };
                        
                        console.log("Selected items:", data.items);
                        
                        if (!data.items.length) {
                            frappe.throw(__("Please select at least one item to continue"));
                        }
                        
                        console.log("Creating design request with items:", data.items);
                        
                        // Create design request
                        frappe.call({
                            method: "design_integration.design_integration.doctype.design_request.design_request.create_design_request_from_sales_order",
                            args: {
                                sales_order: frm.docname,
                                selected_items: data.items
                            },
                            freeze: true,
                            callback: function(r) {
                                console.log("Design request creation response:", r);
                                if (r.message) {
                                    frappe.msgprint({
                                        message: __("Design Request created successfully: {0}", [
                                            `<a href="/app/design-request/${r.message}">${r.message}</a>`
                                        ]),
                                        indicator: "green"
                                    });
                                    d.hide();
                                }
                            },
                            error: function(r) {
                                console.log("Error creating design request:", r);
                                frappe.msgprint({
                                    message: __("Failed to create design request: {0}", [r.responseJSON.message || "Unknown error"]),
                                    indicator: "red"
                                });
                            }
                        });
                    },
                    primary_action_label: __("Create Design Request")
                });
                
                console.log("Showing dialog");
                d.show();
            }
        }
    });
}

// Design Request Form - Add custom buttons
frappe.ui.form.on("Design Request", {
    refresh: function(frm) {
        if (frm.doc.docstatus === 0) {
            // Add status update buttons for project status
            if (frm.has_perm("write")) {
                frm.add_custom_button(__("Mark as Closed"), () => {
                    frm.events.show_close_dialog(frm);
                }, __("Actions"));
                
                frm.add_custom_button(__("Mark as Open"), () => {
                    frm.events.show_open_dialog(frm);
                }, __("Actions"));
                
                frm.add_custom_button(__("Assign To"), () => {
                    frm.events.show_assign_dialog(frm);
                }, __("Actions"));
                
                frm.add_custom_button(__("Add Comment"), () => {
                    frm.events.show_comment_dialog(frm);
                }, __("Actions"));
            }
        }
    },
    
    show_close_dialog: function(frm) {
        let d = new frappe.ui.Dialog({
            title: __("Close Design Request"),
            fields: [
                {
                    fieldtype: "Text Editor",
                    fieldname: "close_remarks",
                    label: __("Closing Remarks"),
                    reqd: 1
                }
            ],
            primary_action: function() {
                let remarks = d.fields_dict.close_remarks.value;
                frappe.call({
                    method: "design_integration.design_integration.doctype.design_request.design_request.update_design_status",
                    args: {
                        design_request: frm.docname,
                        new_status: "Closed"
                    },
                    callback: function() {
                        frm.reload_doc();
                        d.hide();
                    }
                });
            },
            primary_action_label: __("Close Request")
        });
        d.show();
    },
    
    show_open_dialog: function(frm) {
        let d = new frappe.ui.Dialog({
            title: __("Reopen Design Request"),
            fields: [
                {
                    fieldtype: "Text Editor",
                    fieldname: "reopen_remarks",
                    label: __("Reopening Remarks"),
                    reqd: 1
                }
            ],
            primary_action: function() {
                let remarks = d.fields_dict.reopen_remarks.value;
                frappe.call({
                    method: "design_integration.design_integration.doctype.design_request.design_request.update_design_status",
                    args: {
                        design_request: frm.docname,
                        new_status: "Open"
                    },
                    callback: function() {
                        frm.reload_doc();
                        d.hide();
                    }
                });
            },
            primary_action_label: __("Reopen Request")
        });
        d.show();
    },
    
    show_assign_dialog: function(frm) {
        let d = new frappe.ui.Dialog({
            title: __("Assign Design Request"),
            fields: [
                {
                    fieldtype: "Link",
                    fieldname: "assigned_to",
                    label: __("Assign To"),
                    options: "User",
                    default: frm.doc.assigned_to
                }
            ],
            primary_action: function() {
                let assigned_to = d.fields_dict.assigned_to.value;
                frappe.call({
                    method: "design_integration.design_integration.doctype.design_request.design_request.assign_to_user",
                    args: {
                        design_request: frm.docname,
                        user: assigned_to
                    },
                    callback: function() {
                        frm.reload_doc();
                        d.hide();
                    }
                });
            },
            primary_action_label: __("Assign")
        });
        d.show();
    },
    
    show_comment_dialog: function(frm) {
        let d = new frappe.ui.Dialog({
            title: __("Add Comment"),
            fields: [
                {
                    fieldtype: "Text Editor",
                    fieldname: "comment",
                    label: __("Comment"),
                    reqd: 1
                }
            ],
            primary_action: function() {
                let comment = d.fields_dict.comment.value;
                frappe.call({
                    method: "design_integration.design_integration.doctype.design_request.design_request.add_comment",
                    args: {
                        design_request: frm.docname,
                        comment: comment
                    },
                    callback: function() {
                        frm.reload_doc();
                        d.hide();
                    }
                });
            },
            primary_action_label: __("Add")
        });
        d.show();
    }
});

// Design Request Item Form - Handle approval status changes
frappe.ui.form.on("Design Request Item", {
    refresh: function(frm) {
        // Update current stage when design status changes
        if (frm.doc.design_status) {
            frm.set_value("current_stage", frm.doc.design_status);
        }

        // Register Gantt settings for this doctype if not already
        frappe.views.calendar = frappe.views.calendar || {};
        frappe.views.calendar['Design Request Item'] = frappe.views.calendar['Design Request Item'] || {
            gantt: {
                field_map: {
                    start: 'start_date',
                    end: 'completion_date',
                    title: 'item_name',
                    id: 'name'
                }
            }
        };
    },
    
    design_status: function(frm) {
        // Update current stage when design status changes
        frm.set_value("current_stage", frm.doc.design_status);
    },
    
    approval_status: function(frm) {
        // Handle approval status changes
        if (frm.doc.approval_status === "Approved") {
            // Show confirmation dialog
            frappe.confirm(
                __("Are you sure you want to approve this item? This will automatically change the Design Status to 'Design'."),
                function() {
                    // User confirmed
                    frm.set_value("design_status", "Design");
                    frm.set_value("approval_date", frappe.datetime.now_datetime());
                    frappe.msgprint({
                        message: __("Item approved successfully. Design Status changed to 'Design'."),
                        indicator: "green"
                    });
                },
                function() {
                    // User cancelled
                    frm.set_value("approval_status", frm.doc.approval_status);
                }
            );
        } else if (frm.doc.approval_status === "Rejected") {
            // Show confirmation dialog
            frappe.confirm(
                __("Are you sure you want to reject this item? This will automatically change the Design Status to 'On Hold'."),
                function() {
                    // User confirmed
                    frm.set_value("design_status", "On Hold");
                    frappe.msgprint({
                        message: __("Item rejected. Design Status changed to 'On Hold'."),
                        indicator: "orange"
                    });
                },
                function() {
                    // User cancelled
                    frm.set_value("approval_status", frm.doc.approval_status);
                }
            );
        } else if (frm.doc.approval_status === "On Hold") {
            // Show confirmation dialog
            frappe.confirm(
                __("Are you sure you want to put this item on hold? This will automatically change the Design Status to 'On Hold'."),
                function() {
                    // User confirmed
                    frm.set_value("design_status", "On Hold");
                    frappe.msgprint({
                        message: __("Item put on hold. Design Status changed to 'On Hold'."),
                        indicator: "orange"
                    });
                },
                function() {
                    // User cancelled
                    frm.set_value("approval_status", frm.doc.approval_status);
                }
            );
        }
    }
});

// List View Settings for Design Request
frappe.listview_settings["Design Request"] = {
    add_fields: ["status", "priority", "assigned_to", "customer_name", "project_name"],
    get_indicator: function(doc) {
        let colors = {
            "Open": "orange",
            "Closed": "green"
        };
        
        return [__(doc.status), colors[doc.status] || "gray", "status,=," + doc.status];
    },
    
    filters: [
        ["status", "!=", "Closed"]
    ],
    
    onload: function(listview) {
        // Add custom filters
        listview.page.add_inner_button(__("My Requests"), function() {
            listview.filter_area.add_filter("assigned_to", "=", frappe.session.user);
        });
        
        listview.page.add_inner_button(__("Open"), function() {
            listview.filter_area.add_filter("status", "=", "Open");
        });
        
        listview.page.add_inner_button(__("Closed"), function() {
            listview.filter_area.add_filter("status", "=", "Closed");
        });
    }
}; 

// List View Settings for Design Request Item
frappe.listview_settings['Design Request Item'] = {
    onload: function(listview) {
        // Add dropdown for design_status
        listview.page.add_inner_button(__('Design Status'), function() {
            // This will be handled by the dropdown itself
        });
    },
    formatters: {
        design_status: function(value, df, doc) {
            if (!value) return '';
            
            const colors = {
                'Pending': 'orange',
                'Approval Drawing': 'blue',
                'Send for Approval': 'yellow',
                'Design': 'green',
                'Modelling': 'purple',
                'Production Drawing': 'cyan',
                'SKU Generation': 'pink',
                'BOM': 'brown',
                'Nesting': 'gray',
                'Completed': 'green',
                'Cancelled': 'red',
                'On Hold': 'red'
            };
            
            return `<span class="label label-${colors[value] || 'default'}">${value}</span>`;
        },
        approval_status: function(value, df, doc) {
            if (!value) return '';
            
            const colors = {
                'Pending': 'orange',
                'Approved': 'green',
                'Rejected': 'red',
                'On Hold': 'red'
            };
            
            return `<span class="label label-${colors[value] || 'default'}">${value}</span>`;
        }
    }
};

// Global functions for dropdown updates
window.update_design_status = function(docname, new_status) {
    frappe.call({
        method: 'design_integration.design_integration.doctype.design_request_item.design_request_item.update_design_status',
        args: {
            docname: docname,
            new_status: new_status
        },
        callback: function(r) {
            if (r.exc) {
                frappe.msgprint(__('Error updating status: ') + r.exc);
            } else {
                frappe.msgprint({
                    message: __('Status updated successfully'),
                    indicator: 'green'
                });
                // Refresh the list view
                cur_list.refresh();
            }
        }
    });
};

window.update_approval_status = function(docname, new_status) {
    frappe.call({
        method: 'design_integration.design_integration.doctype.design_request_item.design_request_item.update_approval_status',
        args: {
            docname: docname,
            new_status: new_status
        },
        callback: function(r) {
            if (r.exc) {
                frappe.msgprint(__('Error updating approval status: ') + r.exc);
            } else {
                frappe.msgprint({
                    message: __('Approval status updated successfully'),
                    indicator: 'green'
                });
                // Refresh the list view
                cur_list.refresh();
            }
        }
    });
}; 