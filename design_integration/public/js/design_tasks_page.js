// Design Tasks Page - Shows all items from all design requests
frappe.pages['design-tasks'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Design Tasks'),
        single_column: true
    });
    
    // Add refresh button
    page.add_inner_button(__('Refresh'), function() {
        load_tasks_data();
    });
    
    // Create filter section
    let filter_section = $(`
        <div class="filter-section" style="background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
            <div class="row">
                <div class="col-md-2">
                    <label>Task Status</label>
                    <select class="form-control" id="task-status-filter">
                        <option value="">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Approval Drawing">Approval Drawing</option>
                        <option value="Send for Approval">Send for Approval</option>
                        <option value="On Hold">On Hold</option>
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
                        <option value="${frappe.session.user}">My Tasks</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <label>&nbsp;</label><br>
                    <button class="btn btn-primary btn-sm" onclick="apply_task_filters()">Apply Filters</button>
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
                            <h4 id="total-tasks">0</h4>
                            <small>Total Tasks</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card" style="background: #fff3e0; border-left: 4px solid #ff9800;">
                        <div class="card-body text-center">
                            <h4 id="pending-tasks">0</h4>
                            <small>Pending Tasks</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card" style="background: #e8f5e8; border-left: 4px solid #4caf50;">
                        <div class="card-body text-center">
                            <h4 id="completed-tasks">0</h4>
                            <small>Completed Tasks</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card" style="background: #ffebee; border-left: 4px solid #f44336;">
                        <div class="card-body text-center">
                            <h4 id="overdue-tasks">0</h4>
                            <small>Overdue Tasks</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
    
    page.main.append(stats_section);
    
    // Create tasks table
    let tasks_table = $(`
        <div class="tasks-table-section">
            <h5>All Design Tasks</h5>
            <div class="table-responsive">
                <table class="table table-bordered table-hover" id="design-tasks-table">
                    <thead class="thead-light">
                        <tr>
                            <th>Task</th>
                            <th>Project</th>
                            <th>Sales Order</th>
                            <th>Customer</th>
                            <th>Assigned To</th>
                            <th>Task Status</th>
                            <th>Project Status</th>
                            <th>Priority</th>
                            <th>Days</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="tasks-tbody">
                    </tbody>
                </table>
            </div>
        </div>
    `);
    
    page.main.append(tasks_table);
    
    // Load initial data
    load_tasks_data();
    
    // Global function to apply filters
    window.apply_task_filters = function() {
        load_tasks_data();
    };
    
    // Global function to load tasks data
    window.load_tasks_data = function() {
        let filters = {
            status: $('#task-status-filter').val(),
            project_status: $('#project-status-filter').val(),
            customer: $('#customer-filter').val(),
            sales_order: $('#so-filter').val(),
            assigned_to: $('#assigned-filter').val()
        };
        
        frappe.call({
            method: 'design_integration.design_integration.doctype.design_request.design_request.get_all_design_items',
            args: {
                filters: filters,
                sort_by: 'creation',
                sort_order: 'desc'
            },
            callback: function(r) {
                if (r.message) {
                    display_tasks(r.message);
                    update_task_stats(r.message);
                }
            }
        });
    };
    
    // Function to display tasks
    function display_tasks(tasks) {
        let tbody = $('#tasks-tbody');
        tbody.empty();
        
        if (tasks.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="10" class="text-center text-muted">
                        <i class="fa fa-inbox fa-2x"></i><br>
                        No tasks found. Create a design request from a Sales Order to get started.
                    </td>
                </tr>
            `);
            return;
        }
        
        tasks.forEach(function(task) {
            let status_color = get_task_status_color(task.design_status);
            let project_status_color = get_project_status_color(task.request_status);
            let overdue_class = task.is_overdue ? 'table-warning' : '';
            let overdue_text = task.is_overdue ? ' (Overdue)' : '';
            
            let row = $(`
                <tr class="${overdue_class}">
                    <td>
                        <strong>${task.item_code}</strong><br>
                        <small>${task.item_name}</small><br>
                        <small class="text-muted">Qty: ${task.qty} ${task.uom}</small>
                    </td>
                    <td>
                        <a href="/app/design-request/${task.request_id}" target="_blank">
                            ${task.request_id}
                        </a>
                    </td>
                    <td>
                        <a href="/app/sales-order/${task.sales_order}" target="_blank">
                            ${task.sales_order}
                        </a>
                    </td>
                    <td>${task.customer_name}</td>
                    <td>${task.assigned_to || '-'}</td>
                    <td>
                        <span class="badge badge-${status_color}">
                            ${task.design_status}${overdue_text}
                        </span>
                    </td>
                    <td>
                        <span class="badge badge-${project_status_color}">
                            ${task.request_status}
                        </span>
                    </td>
                    <td>
                        <span class="badge badge-${get_priority_color(task.priority)}">
                            ${task.priority || 'Medium'}
                        </span>
                    </td>
                    <td>${task.days_since_request}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            ${get_task_action_buttons(task)}
                        </div>
                    </td>
                </tr>
            `);
            
            tbody.append(row);
        });
    }
    
    // Function to get action buttons for tasks
    function get_task_action_buttons(task) {
        let user_roles = frappe.user_roles;
        let buttons = [];
        
        // Define next possible statuses based on current status
        let next_statuses = {
            "Pending": ["Approval Drawing"],
            "Approval Drawing": ["Send for Approval"],
            "Send for Approval": ["Design", "Approval Drawing", "On Hold"],
            "On Hold": ["Design","Approval Drawing", "Send for Approval"],
            "Design": ["Modelling"],
            "Modelling": ["Production Drawing"],
            "Production Drawing": ["SKU Generation"],
            "SKU Generation": ["BOM"],
            "BOM": ["Nesting"],
            "Nesting": ["Completed"]
        };
        
        let current_status = task.design_status;
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
                    <button class="btn btn-outline-primary btn-sm" onclick="update_task_status('${task.item_id}', '${next_status}')">
                        ${next_status}
                    </button>
                `);
            }
        });
        
        // Add complete button for any status
        if (allowed_statuses.includes("Completed") || frappe.user_roles.includes("Administrator")) {
            buttons.push(`
                <button class="btn btn-outline-success btn-sm" onclick="update_task_status('${task.item_id}', 'Completed')">
                    Complete
                </button>
            `);
        }
        
        return buttons.join('');
    }
    
    // Function to update task statistics
    function update_task_stats(tasks) {
        let total = tasks.length;
        let pending = tasks.filter(task => task.design_status !== 'Completed').length;
        let completed = tasks.filter(task => task.design_status === 'Completed').length;
        let overdue = tasks.filter(task => task.is_overdue).length;
        
        $('#total-tasks').text(total);
        $('#pending-tasks').text(pending);
        $('#completed-tasks').text(completed);
        $('#overdue-tasks').text(overdue);
    }
    
    // Function to get task status color
    function get_task_status_color(status) {
        let colors = {
            'Pending': 'secondary',
            'Approval Drawing': 'warning',
            'Send for Approval': 'info',
            'On Hold': 'warning', // Added On Hold color
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
    
    // Global function to update task status
    window.update_task_status = function(item_id, new_status) {
        frappe.call({
            method: 'design_integration.design_integration.doctype.design_request.design_request.update_item_status',
            args: {
                item_id: item_id,
                new_status: new_status
            },
            callback: function(r) {
                if (r.message) {
                    frappe.msgprint({
                        message: __('Task status updated successfully'),
                        indicator: 'green'
                    });
                    load_tasks_data(); // Refresh the data
                }
            }
        });
    };
}; 