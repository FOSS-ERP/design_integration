// Design Dashboard Page with Charts
frappe.pages['design-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Design Analytics'),
        single_column: true
    });
    
    // Add refresh button
    page.add_inner_button(__('Refresh'), function() {
        load_dashboard_data();
    });
    
    // Create dashboard content
    let dashboard_content = $(`
        <div class="dashboard-content">
            <!-- Statistics Cards -->
            <div class="row" style="margin-bottom: 20px;">
                <div class="col-md-3">
                    <div class="card" style="background: #e3f2fd; border-left: 4px solid #2196f3;">
                        <div class="card-body text-center">
                            <h4 id="total-requests">0</h4>
                            <small>Total Design Requests</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card" style="background: #fff3e0; border-left: 4px solid #ff9800;">
                        <div class="card-body text-center">
                            <h4 id="total-items">0</h4>
                            <small>Total Design Items</small>
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
                            <h4 id="pending-items">0</h4>
                            <small>Pending Items</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Charts Row -->
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5>Design Requests by Status</h5>
                        </div>
                        <div class="card-body">
                            <div id="requests-chart" style="height: 300px;"></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5>Design Items by Stage</h5>
                        </div>
                        <div class="card-body">
                            <div id="stages-chart" style="height: 300px;"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="row" style="margin-top: 20px;">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5>Recent Design Activity</h5>
                        </div>
                        <div class="card-body">
                            <div id="recent-activity">
                                <div class="text-center text-muted">
                                    <i class="fa fa-spinner fa-spin"></i> Loading...
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
    
    page.main.append(dashboard_content);
    
    // Load initial data
    load_dashboard_data();
    
    // Function to load dashboard data
    function load_dashboard_data() {
        // Load statistics
        frappe.call({
            method: 'design_integration.design_integration.doctype.design_request.design_request.get_dashboard_stats',
            callback: function(r) {
                if (r.message) {
                    $('#total-requests').text(r.message.total_requests || 0);
                    $('#total-items').text(r.message.total_items || 0);
                    $('#completed-items').text(r.message.completed_items || 0);
                    $('#pending-items').text(r.message.pending_items || 0);
                }
            }
        });
        
        // Load charts
        load_charts();
        
        // Load recent activity
        load_recent_activity();
    }
    
    // Function to load charts
    function load_charts() {
        // Load design requests chart
        frappe.call({
            method: 'design_integration.design_integration.doctype.design_request.design_request.get_design_requests_chart_data',
            callback: function(r) {
                if (r.message && r.message.labels.length > 0) {
                    create_donut_chart('requests-chart', r.message.labels, r.message.datasets[0].values, 'Design Requests by Status');
                }
            }
        });
        
        // Load design stages chart
        frappe.call({
            method: 'design_integration.design_integration.doctype.design_request.design_request.get_design_stages_chart_data',
            callback: function(r) {
                if (r.message && r.message.labels.length > 0) {
                    create_donut_chart('stages-chart', r.message.labels, r.message.datasets[0].values, 'Design Items by Stage');
                }
            }
        });
    }
    
    // Function to create donut chart
    function create_donut_chart(element_id, labels, values, title) {
        let colors = [
            '#2196f3', '#ff9800', '#4caf50', '#f44336', '#9c27b0',
            '#607d8b', '#795548', '#ff5722', '#00bcd4', '#8bc34a'
        ];
        
        let chart_data = {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
        
        let ctx = document.getElementById(element_id).getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: chart_data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: title
                }
            }
        });
    }
    
    // Function to load recent activity
    function load_recent_activity() {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Design Request Item',
                fields: ['name', 'item_code', 'item_name', 'design_status', 'modified'],
                limit: 10,
                order_by: 'modified desc'
            },
            callback: function(r) {
                if (r.message) {
                    let activity_html = '';
                    r.message.forEach(function(item) {
                        let status_color = get_status_color(item.design_status);
                        activity_html += `
                            <div class="activity-item" style="padding: 10px; border-bottom: 1px solid #eee;">
                                <div class="row">
                                    <div class="col-md-3">
                                        <strong>${item.item_code}</strong>
                                    </div>
                                    <div class="col-md-4">
                                        ${item.item_name}
                                    </div>
                                    <div class="col-md-3">
                                        <span class="badge badge-${status_color}">${item.design_status}</span>
                                    </div>
                                    <div class="col-md-2">
                                        <small class="text-muted">${frappe.datetime.comment_when(item.modified)}</small>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    $('#recent-activity').html(activity_html);
                }
            }
        });
    }
    
    // Function to get status color
    function get_status_color(status) {
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
            'Completed': 'success',
            'Cancelled': 'danger'
        };
        return colors[status] || 'secondary';
    }
}; 