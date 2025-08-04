// Design Items Dashboard Page
frappe.pages['design-items-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Design Items Dashboard'),
        single_column: true
    });
    
    // Add filters section
    page.add_inner_button(__('Refresh'), function() {
        load_dashboard_data();
    });
    
    // Create filter section
    let filter_section = $(`
        <div class="filter-section" style="background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
            <div class="row">
                <div class="col-md-2">
                    <label>Item Status</label>
                    <select class="form-control" id="status-filter">
                        <option value="">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Approval Drawing">Approval Drawing</option>
                        <option value="Send for Approval">Send for Approval</option>
                        <option value="Design">Design</option>
                        <option value="Modelling">Modelling</option>
                        <option value="Production Drawing">Production Drawing</option>
                        <option value="SKU Generation">SKU Generation</option>
                        <option value="BOM">BOM</option>
                        <option value="Nesting">Nesting</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <label>Project Status</label>
                    <select class="form-control" id="project-status-filter">
                        <option value="">All Projects</option>
                        <option value="Open">Open Projects</option>
                        <option value="Closed">Closed Projects</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <label>Customer</label>
                    <input type="text" class="form-control" id="customer-filter" placeholder="Search customer">
                </div>
                <div class="col-md-2">
                    <label>Sales Order</label>
                    <input type="text" class="form-control" id="so-filter" placeholder="Search SO">
                </div>
                <div class="col-md-2">
                    <label>Assigned To</label>
                    <select class="form-control" id="assigned-filter">
                        <option value="">All Users</option>
                        <option value="${frappe.session.user}">My Items</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <label>&nbsp;</label><br>
                    <button class="btn btn-primary btn-sm" onclick="apply_filters()">Apply Filters</button>
                </div>
            </div>
        </div>
    `);
    
    page.main.append(filter_section);
    
    // Create stats section
    let stats_section = $(`
        <div class="stats-section" style="margin-bottom: 20px;">
            <div class="row">
                <div class="col-md-3">
                    <div class="card" style="background: #e3f2fd; border-left: 4px solid #2196f3;">
                        <div class="card-body text-center">
                            <h4 id="total-items">0</h4>
                            <small>Total Items</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card" style="background: #fff3e0; border-left: 4px solid #ff9800;">
                        <div class="card-body text-center">
                            <h4 id="pending-items">0</h4>
                            <small>Pending Items</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card" style="background: #e8f5e8; border-left: 4px solid #4caf50;">
                        <div class="card-body text-center">
                            <h4 id="completed-items">0</h4>
                            <small>Completed Items</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card" style="background: #ffebee; border-left: 4px solid #f44336;">
                        <div class="card-body text-center">
                            <h4 id="overdue-items">0</h4>
                            <small>Overdue Items</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
    
    page.main.append(stats_section);
    
    // Create items table
    let items_table = $(`
        <div class="items-table-section">
            <h5>Design Items (Tasks)</h5>
            <div class="table-responsive">
                <table class="table table-bordered table-hover" id="design-items-table">
                    <thead class="thead-light">
                        <tr>
                            <th>Item</th>
                            <th>Project</th>
                            <th>Sales Order</th>
                            <th>Customer</th>
                            <th>Assigned To</th>
                            <th>Item Status</th>
                            <th>Project Status</th>
                            <th>Priority</th>
                            <th>Days</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="items-tbody">
                    </tbody>
                </table>
            </div>
        </div>
    `);
    
    page.main.append(items_table);
    
    // Load initial data
    load_dashboard_data();
    
    // Global function to apply filters
    window.apply_filters = function() {
        load_dashboard_data();
    };
    
    // Global function to load dashboard data
    window.load_dashboard_data = function() {
        let filters = {
            status: $('#status-filter').val(),
            project_status: $('#project-status-filter').val(),
            customer: $('#customer-filter').val(),
            sales_order: $('#so-filter').val(),
            assigned_to: $('#assigned-filter').val()
        };
        
        let sort_by = $('#sort-filter').val();
        
        frappe.call({
            method: 'design_integration.design_integration.doctype.design_request.design_request.get_all_design_items',
            args: {
                filters: filters,
                sort_by: sort_by,
                sort_order: 'desc'
            },
            callback: function(r) {
                if (r.message) {
                    display_items(r.message);
                    update_stats(r.message);
                }
            }
        });
    };
    
    // Function to display items
    function display_items(items) {
        let tbody = $('#items-tbody');
        tbody.empty();
        
        items.forEach(function(item) {
            let status_color = get_status_color(item.design_status);
            let project_status_color = get_project_status_color(item.request_status);
            let overdue_class = item.is_overdue ? 'table-warning' : '';
            let overdue_text = item.is_overdue ? ' (Overdue)' : '';
            
            let row = $(`
                <tr class="${overdue_class}">
                    <td>
                        <strong>${item.item_code}</strong><br>
                        <small>${item.item_name}</small><br>
                        <small class="text-muted">Qty: ${item.qty} ${item.uom}</small>
                    </td>
                    <td>
                        <a href="/app/design-request/${item.request_id}" target="_blank">
                            ${item.request_id}
                        </a>
                    </td>
                    <td>
                        <a href="/app/sales-order/${item.sales_order}" target="_blank">
                            ${item.sales_order}
                        </a>
                    </td>
                    <td>${item.customer_name}</td>
                    <td>${item.assigned_to || '-'}</td>
                    <td>
                        <span class="badge badge-${status_color}">
                            ${item.design_status}${overdue_text}
                        </span>
                    </td>
                    <td>
                        <span class="badge badge-${project_status_color}">
                            ${item.request_status}
                        </span>
                    </td>
                    <td>
                        <span class="badge badge-${get_priority_color(item.priority)}">
                            ${item.priority || 'Medium'}
                        </span>
                    </td>
                    <td>${item.days_since_request}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            ${get_action_buttons(item)}
                        </div>
                    </td>
                </tr>
            `);
            
            tbody.append(row);
        });
    }
    
    // Function to get action buttons based on current status and user role
    function get_action_buttons(item) {
        let user_roles = frappe.user_roles;
        let buttons = [];
        
        // Define next possible statuses based on current status
        let next_statuses = {
            "Pending": ["Approval Drawing"],
            "Approval Drawing": ["Send for Approval"],
            "Send for Approval": ["Design", "Approval Drawing"], // Can go back if rejected
            "Design": ["Modelling"],
            "Modelling": ["Production Drawing"],
            "Production Drawing": ["SKU Generation"],
            "SKU Generation": ["BOM"],
            "BOM": ["Nesting"],
            "Nesting": ["Completed"]
        };
        
        let current_status = item.design_status;
        let possible_next = next_statuses[current_status] || [];
        
        // Check user permissions
        let role_permissions = {
            "Project Manager": ["Approval Drawing", "Send for Approval", "Design"],
            "Project User": ["Approval Drawing", "Send for Approval", "Design"],
            "Design Manager": ["Send for Approval", "Modelling", "Production Drawing", "BOM", "Nesting"],
            "Design User": ["Send for Approval", "Modelling", "Production Drawing", "BOM", "Nesting"]
        };
        
        let allowed_statuses = [];
        for (let role of user_roles) {
            if (role_permissions[role]) {
                allowed_statuses = allowed_statuses.concat(role_permissions[role]);
            }
        }
        
        // Add buttons for allowed next statuses
        possible_next.forEach(function(next_status) {
            if (allowed_statuses.includes(next_status) || frappe.user_roles.includes("Administrator")) {
                buttons.push(`
                    <button class="btn btn-outline-primary btn-sm" onclick="update_item_status('${item.item_id}', '${next_status}')">
                        ${next_status}
                    </button>
                `);
            }
        });
        
        // Add complete button for any status
        if (allowed_statuses.includes("Completed") || frappe.user_roles.includes("Administrator")) {
            buttons.push(`
                <button class="btn btn-outline-success btn-sm" onclick="update_item_status('${item.item_id}', 'Completed')">
                    Complete
                </button>
            `);
        }
        
        return buttons.join('');
    }
    
    // Function to update statistics
    function update_stats(items) {
        let total = items.length;
        let pending = items.filter(item => item.design_status !== 'Completed').length;
        let completed = items.filter(item => item.design_status === 'Completed').length;
        let overdue = items.filter(item => item.is_overdue).length;
        
        $('#total-items').text(total);
        $('#pending-items').text(pending);
        $('#completed-items').text(completed);
        $('#overdue-items').text(overdue);
    }
    
    // Function to get status color
    function get_status_color(status) {
        let colors = {
            'Pending': 'secondary',
            'Approval Drawing': 'warning',
            'Send for Approval': 'info',
            'Design': 'primary',
            'Modelling': 'purple',
            'Production Drawing': 'indigo',
            'SKU Generation': 'pink',
            'BOM': 'success',
            'Nesting': 'dark',
            'Completed': 'success',
            'Cancelled': 'danger'
        };
        return colors[status] || 'secondary';
    }
    
    // Function to get project status color
    function get_project_status_color(status) {
        let colors = {
            'Open': 'orange',
            'Closed': 'green'
        };
        return colors[status] || 'secondary';
    }
    
    // Function to get priority color
    function get_priority_color(priority) {
        let colors = {
            'Low': 'success',
            'Medium': 'warning',
            'High': 'danger'
        };
        return colors[priority] || 'warning';
    }
    
    // Global function to update item status
    window.update_item_status = function(item_id, new_status) {
        frappe.call({
            method: 'design_integration.design_integration.doctype.design_request.design_request.update_item_status',
            args: {
                item_id: item_id,
                new_status: new_status
            },
            callback: function(r) {
                if (r.message) {
                    frappe.msgprint({
                        message: __('Item status updated successfully'),
                        indicator: 'green'
                    });
                    load_dashboard_data(); // Refresh the data
                }
            }
        });
    };
}; 