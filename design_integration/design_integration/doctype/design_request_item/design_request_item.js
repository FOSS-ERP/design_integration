frappe.ui.form.on("Design Request Item", {
    refresh(frm) {
        createTwoColumnLayout(frm);
        
        // Add custom buttons
        addCustomButtons(frm);
        addBomImportButton(frm);

        // Enforce allowed design_status options based on approval_status
        enforceDesignStatusOptions(frm);
        toggle_status_fields(frm);

        if (!frm.doc.__islocal) {

            frm.add_custom_button(__("+ Add New Version"), () => {

                frappe.call({
                    method:"design_integration.design_integration.doctype.design_request_item.design_request_item.get_version_meta_data",
                    callback:(r)=>{
                        if(!r.message) return;

                        // Build dialog fields except design_request_item
                        const fields = r.message.fields
                            .filter(df => df.fieldname !== "design_request_item")
                            .map(df => {
                                return {
                                    ...df,
                                    read_only: df.fieldname === "version_tag" ? 1 : 0
                                }
                            });

                        let d = new frappe.ui.Dialog({
                            title: "Add Design Version",
                            fields: fields,
                            primary_action_label: "Create",

                            primary_action(values) {

                                // Force-set link without showing in dialog
                                values.design_request_item = frm.doc.name;

                                frappe.call({
                                    method: "frappe.client.insert",
                                    args: {
                                        doc: {
                                            doctype: "Design Version",
                                            ...values
                                        }
                                    },
                                    callback(r) {
                                        if (!r.exc) {
                                            frappe.msgprint("Design Version Created");
                                            d.hide();
                                            frappe.call({
                                                method: "frappe.client.set_value",
                                                args: {
                                                    doctype: "Design Request Item",
                                                    name: frm.doc.name,
                                                    fieldname:  "revision_reason",
                                                    value: ""
                                                },
                                                callback: () => {
                                                    frm.reload_doc()
                                                }
                                            })
                                            // frm.refresh()
                                        }
                                    }
                                });
                            }
                        });
                        let version_tag = `V${frm.doc.revision_count}`
                        frappe.call({
                            method : "design_integration.design_integration.doctype.design_request_item.design_request_item.get_next_version_tag",
                            args : {
                                design_request_item : frm.doc.name
                            },
                            callback:(r)=>{
                                if (!r.message) return;
                                d.set_value("version_tag", r.message)
                                d.set_value("description" , frm.doc.revision_reason || "")
                                d.show();
                            }
                        })
                        
                    }
                })
            });

        }
        render_all_versions(frm)
        frm.set_query("bom_name", ()=>{
            return {
				filters: {
					item : frm.doc.new_item_code,
				},
			};
        })
    },
    
    design_status: function(frm) {
        // Update current stage when design status changes
        frm.set_value("current_stage", frm.doc.design_status);
        toggle_status_fields(frm);
        addBomImportButton(frm);
        // Auto-save when design status changes
        if (frm.doc.design_status) {
            frm.save(null, function() {
                addBomImportButton(frm);
                frappe.show_alert({
                    message: __("Status updated and saved automatically"),
                    indicator: "green"
                }, 3);
            });
        }
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
        // Auto-save when approval status changes
        if (frm.doc.approval_status) {
            frm.save(null, function() {
                frappe.show_alert({
                    message: __("Approval status updated and saved automatically"),
                    indicator: "green"
                }, 3);
            });
        }

        // Refresh allowed options based on new approval_status
        enforceDesignStatusOptions(frm);
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
                        // Auto-save after setting the item name
                        frm.save();
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

    update_sales_order_item: function(frm) {
        updateSalesOrderItemFromDesign(frm);
    },
    
    bom_name: function(frm) {
        // Auto-update BOM Created when BOM is selected
        if (frm.doc.bom_name) {
            frm.set_value("bom_created", 1);
            frappe.msgprint({
                message: __("BOM Created automatically set to Yes."),
                indicator: "green"
            });
            // Auto-save after setting BOM created
            frm.save();
        } else {
            frm.set_value("bom_created", 0);
        }
    }
});

function toggle_status_fields(frm) {
    const is_completed = frm.doc.design_status === "Completed"

    frm.set_df_property("design_status","read_only", is_completed)
    frm.set_df_property("approval_status", "read_only", is_completed)
}


function render_all_versions(frm){
    if (frm.is_new()) return;

    // fetch linked design versions
    frappe.call({
        method: "design_integration.design_integration.doctype.design_request_item.design_request_item.get_version_list",
        args: {
            design_request_item: frm.doc.name
        },
        callback: function(r) {
            console.log(r)
            if (!r.message || r.message.length === 0) {
                frm.fields_dict.version_view.$wrapper.html(`
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fa fa-layer-group"></i>
                        </div>
                        <h4>No Versions Found</h4>
                        <p class="text-muted">No design versions have been uploaded yet.</p>
                    </div>
                `);
                return;
            }

            let html = `
                <div class="versions-container">
                    <div class="versions-header">
                        <h4><i class="fa fa-history"></i> Design Versions</h4>
                        <span class="badge">${r.message.length} version${r.message.length > 1 ? 's' : ''}</span>
                    </div>
                    <div class="versions-timeline">
            `;

            r.message.forEach((row, index) => {
                let file_html = "";
                let file_preview = "";
                let file_badge = "";

                if (row.new_version_file) {
                    let ext = row.new_version_file.split('.').pop().toLowerCase();
                    let fileName = row.new_version_file.split('/').pop();
                    
                    // Determine file type and icon
                    if (["png","jpg","jpeg","webp","gif","bmp"].includes(ext)) {
                        file_badge = `<span class="file-badge image-badge"><i class="fa fa-image"></i> Image</span>`;
                        file_preview = `
                            <div class="file-preview">
                                <img src="${row.new_version_file}" class="preview-image" alt="${row.version_tag || 'Design'}">
                                <div class="preview-overlay">
                                    <a href="${row.new_version_file}" target="_blank" class="preview-link">
                                        <i class="fa fa-expand"></i> View Full Size
                                    </a>
                                </div>
                            </div>
                        `;
                    } 
                    else if (ext === "pdf") {
                        file_badge = `<span class="file-badge pdf-badge"><i class="fa fa-file-pdf"></i> PDF</span>`;
                        file_preview = `
                            <div class="file-preview">
                                <div class="pdf-placeholder">
                                    <i class="fa fa-file-pdf pdf-icon"></i>
                                    <p>${fileName}</p>
                                    <a href="${row.new_version_file}" target="_blank" class="btn-view-pdf">
                                        <i class="fa fa-eye"></i> View PDF
                                    </a>
                                </div>
                            </div>
                        `;
                    }
                    else if (["doc","docx","odt"].includes(ext)) {
                        file_badge = `<span class="file-badge doc-badge"><i class="fa fa-file-word"></i> Document</span>`;
                    }
                    else if (["ai","psd","eps","svg"].includes(ext)) {
                        file_badge = `<span class="file-badge design-badge"><i class="fa fa-palette"></i> Design File</span>`;
                    }
                    else {
                        file_badge = `<span class="file-badge"><i class="fa fa-file"></i> ${ext.toUpperCase()}</span>`;
                    }
                }

                // Format date
                let formattedDate = row.posting_date ? frappe.format(row.posting_date, { fieldtype: 'Date' }) : 'Not set';
                
                // Determine version status color
                const statusColors = ['primary', 'success', 'warning', 'info'];
                const colorIndex = index % statusColors.length;
                
                html += `
                    <div class="version-card" data-version-name="${row.name}">
                        <div class="version-header">
                            <div class="version-marker" style="background-color: var(--${statusColors[colorIndex]})">
                                <span class="version-number">V${index + 1}</span>
                            </div>
                            <div class="version-info">
                                <h5>
                                    ${row.version_tag || `Version ${index + 1}`}
                                    ${file_badge}
                                </h5>
                                <div class="version-meta">
                                    <span class="meta-item">
                                        <i class="fa fa-calendar"></i> ${formattedDate}
                                    </span>
                                    ${row.created_by ? `<span class="meta-item"><i class="fa fa-user"></i> ${row.created_by}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        
                        ${row.description ? `
                            <div class="version-description">
                                <i class="fa fa-align-left"></i>
                                <p>${row.description}</p>
                            </div>
                        ` : ''}
                        
                        ${file_preview ? `
                            <div class="version-preview">
                                ${file_preview}
                            </div>
                        ` : ''}
                        
                        <div class="version-actions">
                            <div class="action-buttons">
                                ${row.new_version_file ? `
                                    <a href="${row.new_version_file}" target="_blank" class="btn btn-sm btn-primary">
                                        <i class="fa fa-external-link"></i> Open
                                    </a>
                                    <a href="${row.new_version_file}" target="_blank" class="btn btn-sm btn-default" download>
                                        <i class="fa fa-download"></i> Download
                                    </a>
                                ` : ''}
                                <button class="btn btn-sm btn-danger btn-delete-version" data-version-name="${row.name}">
                                    <i class="fa fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;

            frm.fields_dict.version_view.$wrapper.html(html);
            
            // Add event listeners for delete buttons
            addDeleteListeners(frm);
        }
    });
}

function addDeleteListeners(frm) {
    // Remove any existing listeners first
    $('.btn-delete-version').off('click');
    
    // Add click event for delete buttons
    $('.btn-delete-version').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const versionName = $(this).data('version-name');
        const versionCard = $(this).closest('.version-card');
        const versionTitle = versionCard.find('h5').text().trim().split('\n')[0];
        
        // Show confirmation dialog
        frappe.confirm(
            `Are you sure you want to delete "${versionTitle}"?<br><br>
            <small class="text-muted">This action cannot be undone.</small>`,
            () => {
                // User confirmed - delete the version
                deleteVersion(frm, versionName, versionCard);
            },
            () => {
                // User cancelled
                console.log('Delete cancelled');
            }
        );
    });
}

function deleteVersion(frm, versionName, versionCard) {
    // Show loading state
    versionCard.addClass('deleting');
    versionCard.find('.btn-delete-version').html('<i class="fa fa-spinner fa-spin"></i> Deleting...').prop('disabled', true);
    
    frappe.call({
        method: "design_integration.design_integration.doctype.design_request_item.design_request_item.delete_version",
        args: {
            version_name: versionName,
            design_request_item: frm.doc.name
        },
        callback: function(r) {
            if (r.exc) {
                // Show error message
                frappe.show_alert({
                    message: __('Error deleting version. Please try again.'),
                    indicator: 'red'
                });
                versionCard.removeClass('deleting');
                versionCard.find('.btn-delete-version').html('<i class="fa fa-trash"></i> Delete').prop('disabled', false);
                return;
            }
            
            // Show success message
            frappe.show_alert({
                message: __('Version deleted successfully'),
                indicator: 'green'
            });
            
            // Add fade out animation
            versionCard.addClass('fade-out');
            
            // Remove card after animation
            setTimeout(() => {
                // Refresh the versions list
                render_all_versions(frm);
                
                // Refresh the form to update any related data
                frm.refresh();
            }, 300);
        }
    });
}

function addCustomButtons(frm) {
    // Add custom buttons to the form
    frm.add_custom_button(__('Update Status'), function() {
        showStatusDialog(frm);
    }, __('Actions'));
    
    frm.add_custom_button(__('Assign To'), function() {
        showAssignDialog(frm);
    }, __('Actions'));
    
    frm.add_custom_button(__('Add Approval Remarks'), function() {
        showApprovalRemarksDialog(frm);
    }, __('Actions'));

    // Mark Revision button
    frm.add_custom_button(__('Mark Revision'), function() {
        showRevisionDialog(frm);
    }, __('Actions'));
}

function addBomImportButton(frm) {
    const is_bom_stage = [frm.doc.design_status, frm.doc.current_stage].includes('BOM');
    if (!is_bom_stage) {
        return;
    }

    if (frm.remove_custom_button) {
        frm.remove_custom_button(__('Generate BOM from Sheet'), __('Actions'));
    }

    frm.add_custom_button(__('Generate BOM from Sheet'), function() {
        generateBomFromSheet(frm);
    }, __('Actions'));

    addBomImportFieldButton(frm);
}

function addBomImportFieldButton(frm) {
    const fieldname = frm.fields_dict.custom_bom_importer ? 'custom_bom_importer' : 'custom_bom_for_import';
    const field = frm.fields_dict[fieldname];
    if (!field || !field.$wrapper) {
        return;
    }

    field.$wrapper.find('.generate-bom-from-sheet-inline').remove();
    const $button = $(`
        <button class="btn btn-xs btn-primary generate-bom-from-sheet-inline" style="margin-top: 8px;">
            ${__('Generate BOM from Sheet')}
        </button>
    `);
    $button.on('click', function() {
        generateBomFromSheet(frm);
    });
    field.$wrapper.append($button);
}

function generateBomFromSheet(frm) {
    if (frm.is_dirty()) {
        frappe.msgprint({
            title: __('Save Required'),
            message: __('Please save the Design Request Item before generating BOM.'),
            indicator: 'orange'
        });
        return;
    }

    const bom_import_file = frm.doc.custom_bom_for_import || frm.doc.custom_bom_importer;
    const missing = [];
    if (!frm.doc.new_item_code) {
        missing.push(__('Final Item Code'));
    }
    if (!frm.doc.item_created) {
        missing.push(__('Item Created'));
    }
    if (!bom_import_file) {
        missing.push(__('BOM Import Sheet'));
    }
    if (missing.length) {
        frappe.msgprint({
            title: __('Cannot Generate BOM'),
            message: __('Please complete these fields first: {0}', [missing.join(', ')]),
            indicator: 'orange'
        });
        return;
    }

    frappe.confirm(
        __('This will create missing child Items and generate all child and parent BOMs. Continue?'),
        function() {
            frappe.call({
                method: 'design_integration.design_integration.doctype.design_request_item.design_request_item.generate_bom_from_design_sheet',
                args: {
                    design_request_item: frm.doc.name
                },
                freeze: true,
                freeze_message: __('Generating child Items and BOM structure...'),
                callback: function(r) {
                    if (!r.exc && r.message) {
                        frappe.msgprint({
                            title: __('BOM Generated'),
                            message: __('Finished Goods BOM: {0}', [r.message.fg_bom]),
                            indicator: 'green'
                        });
                        frm.reload_doc();
                    }
                }
            });
        }
    );
}

function createTwoColumnLayout(frm) {
    // Remove existing layout
    frm.page.clear_inner_toolbar();
    
    // Create sections for better organization
    if (!frm.sections) {
        frm.sections = {};
    }
    
    // Ensure all fields are visible by removing any hidden attributes
    frm.fields.forEach(function(field) {
        if (field.df.fieldname === 'new_item_code' || field.df.fieldname === 'new_item_name') {
            field.df.hidden = 0;
            field.df.read_only = field.df.fieldname === 'new_item_name' ? 1 : 0;
        }
    });
}

function enforceDesignStatusOptions(frm) {
    // Allowed sets
    const preApproval = ['Pending','Approval Drawing','Send for Approval','Cancelled'];
    const postApproval = ['Design','Modelling','Production Drawing','SKU Generation','BOM','Nesting','SO Updated','Completed','Cancelled'];

    let options = preApproval;
    if (frm.doc.approval_status === 'Approved') {
        options = postApproval;
    } else if (frm.doc.approval_status === 'Rejected') {
        options = preApproval;
    }

    if (!canCloseDesignItem(frm)) {
        options = options.filter(status => !['Completed', 'Cancelled'].includes(status));
    }

    frm.set_df_property('design_status', 'options', options.join('\n'));

    // If current value not in allowed, reset to first allowed
    if (frm.doc.design_status && !options.includes(frm.doc.design_status)) {
        frm.set_value('design_status', options[0]);
    }
}

function canCloseDesignItem(frm) {
    return Boolean(frm.doc.sku_generated && frm.doc.item_created && frm.doc.new_item_code && frm.doc.bom_created && frm.doc.bom_name);
}


function showStatusDialog(frm) {
    let status_options = ['Pending','Approval Drawing','Send for Approval','Design','Modelling','Production Drawing','SKU Generation','BOM','Nesting','SO Updated','Completed','Cancelled'];
    if (!canCloseDesignItem(frm)) {
        status_options = status_options.filter(status => !['Completed', 'Cancelled'].includes(status));
    }

    frappe.prompt({
        label: __('Design Status'),
        fieldtype: 'Select',
        options: status_options.join('\n'),
        default: frm.doc.design_status || 'Pending'
    }, function(values) {
        frm.set_value('design_status', values.design_status);
        frm.save(null, function() {
            frappe.show_alert({
                message: __("Status updated successfully"),
                indicator: "green"
            }, 3);
        });
    }, __('Update Status'), __('Update'));
}

function updateSalesOrderItemFromDesign(frm) {
    if (frm.is_dirty()) {
        frappe.msgprint({
            title: __('Save Required'),
            message: __('Please save the Design Request Item before updating the Sales Order.'),
            indicator: 'orange'
        });
        return;
    }

    if (frm.doc.design_status !== 'Nesting') {
        frappe.msgprint({
            title: __('Cannot Update Sales Order'),
            message: __('Sales Order can be updated only from Nesting status.'),
            indicator: 'orange'
        });
        return;
    }

    if (!frm.doc.new_item_code) {
        frappe.msgprint({
            title: __('Cannot Update Sales Order'),
            message: __('Final Item Code is required before updating the Sales Order.'),
            indicator: 'orange'
        });
        return;
    }

    frappe.confirm(
        __('This will replace the original Sales Order item with Final Item Code {0} and mark this Design Request Item as SO Updated. Continue?', [frm.doc.new_item_code]),
        function() {
            frappe.call({
                method: 'design_integration.design_integration.doctype.design_request_item.design_request_item.update_sales_order_item_from_design',
                args: {
                    docname: frm.doc.name
                },
                freeze: true,
                freeze_message: __('Updating Sales Order Item...'),
                callback: function(r) {
                    if (!r.exc && r.message) {
                        frappe.msgprint({
                            title: __('Sales Order Updated'),
                            message: __('Sales Order {0} item updated from {1} to {2}.', [
                                r.message.sales_order,
                                r.message.old_item_code,
                                r.message.new_item_code
                            ]),
                            indicator: 'green'
                        });
                        frm.reload_doc();
                    }
                }
            });
        }
    );
}

function showAssignDialog(frm) {
    frappe.prompt({
        label: __('Assign To'),
        fieldtype: 'Link',
        options: 'User',
        default: frm.doc.assigned_to || ''
    }, function(values) {
        frm.set_value('assigned_to', values.assigned_to);
        frm.save(null, function() {
            frappe.show_alert({
                message: __("Item assigned successfully"),
                indicator: "green"
            }, 3);
        });
    }, __('Assign'), __('Assign'));
}

function showApprovalRemarksDialog(frm) {
    frappe.prompt({
        label: __('Approval Remarks'),
        fieldtype: 'Text Editor',
        default: frm.doc.approval_remarks || ''
    }, function(values) {
        frm.set_value('approval_remarks', values.approval_remarks);
        frm.save(null, function() {
            frappe.show_alert({
                message: __("Approval remarks added successfully"),
                indicator: "green"
            }, 3);
        });
    }, __('Add Remarks'), __('Save'));
} 



function showRevisionDialog(frm) {
    if (!['Modelling','Production Drawing','BOM','Nesting','Completed','Design'].includes(frm.doc.design_status)) {
        frappe.msgprint(__('Revision can be marked from Design and later stages.'));
        return;
    }

    const d = new frappe.ui.Dialog({
        title: __('Mark Revision'),
        fields: [
            { fieldtype: 'Small Text', fieldname: 'revision_reason', label: __('Revision Details'), reqd: 1 },
            { fieldtype: 'Small Text', fieldname: 'revision_remark', label: __('Remarks') }
        ],
        primary_action_label: __('Submit'),
        primary_action: function() {
            const values = d.get_values();
            frm.set_value('revision_reason', values.revision_reason || '');
            frm.set_value('approval_status', 'Revised');
            frm.set_value('approval_remarks', values.revision_remark || '');
            frm.set_value('revision_requested', 1);
            frm.save(null, function() {
                frappe.show_alert({ message: __('Revision requested'), indicator: 'orange' }, 3);
                d.hide();
            });
        }
    });
    d.show();
}
