import frappe
from frappe import _
from frappe.utils import now_datetime, getdate
from frappe.model.document import Document

def has_permission():
    """Standalone function for app permission check"""
    return frappe.has_permission("Design Request", "read")

class DesignRequest(Document):
    def autoname(self):
        """Auto-generate name based on sales order"""
        if self.sales_order:
            # Get the base name from sales order
            base_name = self.sales_order
            
            # Check if there are existing design requests for this sales order
            existing_requests = frappe.get_all(
                "Design Request",
                filters={"sales_order": self.sales_order},
                fields=["name"],
                order_by="creation desc"
            )
            
            if existing_requests:
                # Find the highest suffix number
                max_suffix = 0
                for req in existing_requests:
                    if req.name.startswith(base_name + "-"):
                        try:
                            suffix = int(req.name.split("-")[-1])
                            max_suffix = max(max_suffix, suffix)
                        except ValueError:
                            continue
                
                # Create new name with incremented suffix
                self.name = f"{base_name}-{max_suffix + 1}"
            else:
                # First design request for this sales order
                self.name = f"{base_name}-1"
        else:
            # Fallback to naming series if no sales order
            if not self.naming_series:
                self.naming_series = "DES-REQ-.YYYY.-"
    
    def validate(self):
        """Validate the design request"""
        self.set_request_date()
        self.assign_roles()
    
    def before_insert(self):
        """Set initial values before insert"""
        if not self.request_date:
            self.request_date = now_datetime()
    
    def after_insert(self):
        """Actions after insert"""
        self.check_completion_status()
    
    def on_update(self):
        """Actions on update"""
        self.check_completion_status()
    
    def set_request_date(self):
        """Set request date if not set"""
        if not self.request_date:
            self.request_date = now_datetime()
    
    def assign_roles(self):
        """Assign roles based on assigned user"""
        if self.assigned_to:
            user_roles = frappe.get_roles(self.assigned_to)
            
            if "Design Manager" in user_roles:
                self.design_manager = self.assigned_to
            elif "Design User" in user_roles:
                self.design_user = self.assigned_to
            
            if "Project Manager" in user_roles:
                self.project_manager = self.assigned_to
            elif "Project User" in user_roles:
                self.project_user = self.assigned_to
    
    def validate_sales_order(self):
        if self.sales_order:
            sales_order = frappe.get_doc("Sales Order", self.sales_order)
            if sales_order.docstatus != 1:
                frappe.throw(_("Sales Order must be submitted"))
    
    def update_project_details(self):
        if self.sales_order:
            sales_order = frappe.get_doc("Sales Order", self.sales_order)
            if sales_order.project:
                self.project = sales_order.project
                project = frappe.get_doc("Project", sales_order.project)
                self.project_name = project.project_name
                self.customer = sales_order.customer
                self.customer_name = sales_order.customer_name
    
    def check_completion_status(self):
        """Check if all items are completed and update request status"""
        if self.items:
            all_completed = all(item.design_status == "Completed" for item in self.items)
            if all_completed and self.status != "Closed":
                self.status = "Closed"
                self.actual_completion = now_datetime()
                self.save()
                frappe.msgprint(_("All items completed. Design Request marked as closed."))
    
    def log_stage_transition(self):
        """Log stage transitions for Gantt chart data"""
        if self.has_value_changed("status"):
            self.append("stage_transition_log", {
                "stage": "Design Request",
                "from_status": self.get_doc_before_save().status if self.get_doc_before_save() else "New",
                "to_status": self.status,
                "transition_date": now_datetime(),
                "transitioned_by": frappe.session.user,
                "remarks": f"Status changed to {self.status}"
            })
    
    def send_assignment_notification(self):
        if self.assigned_to:
            # Send ZohoCliq notification using razorpay_frappe integration
            try:
                from razorpay_frappe.utils import send_zohocliq_message
                
                message = {
                    "card": {
                        "title": "DESIGN REQUEST ASSIGNED",
                        "theme": "modern-inline",
                    },
                    "text": f"**Design Request {self.name}** has been assigned to {self.assigned_to}",
                    "slides": [
                        {
                            "type": "table",
                            "title": "Request Details",
                            "data": {
                                "headers": ["Field", "Value"],
                                "rows": [
                                    {"Field": "Request ID", "Value": self.name},
                                    {"Field": "Sales Order", "Value": self.sales_order},
                                    {"Field": "Project", "Value": self.project_name or "Not set"},
                                    {"Field": "Customer", "Value": self.customer_name},
                                    {"Field": "Status", "Value": self.status},
                                    {"Field": "Priority", "Value": self.priority}
                                ]
                            }
                        }
                    ]
                }
                
                # Get ZohoCliq settings
                settings = frappe.get_doc("Razorpay Settings")
                if settings.design_channel_unique:
                    send_zohocliq_message(
                        message,
                        settings.design_channel_unique,
                        "Design Request Assignment"
                    )
            except Exception as e:
                frappe.log_error(f"Failed to send ZohoCliq notification: {str(e)}")
    
    def update_design_status(self, new_status):
        """Update the design status"""
        self.status = new_status
        if new_status == "Closed":
            self.actual_completion = now_datetime()
        self.save()
        frappe.msgprint(f"Design Request status updated to {new_status}")
    
    def assign_to_user(self, user):
        """Assign the design request to a user"""
        self.assigned_to = user
        self.assigned_date = now_datetime()
        self.save()
        frappe.msgprint(f"Design Request assigned to {user}")
    
    def add_comment(self, comment):
        """Add a comment to the design request"""
        frappe.get_doc({
            "doctype": "Comment",
            "comment_type": "Comment",
            "reference_doctype": "Design Request",
            "reference_name": self.name,
            "content": comment,
            "comment_by": frappe.session.user
        }).insert()
        frappe.msgprint("Comment added successfully")

    def has_permission(self, ptype, user=None):
        """Check if user has permission to access Design Request"""
        if not user:
            user = frappe.session.user
        
        if frappe.has_permission("Design Request", ptype, user=user):
            return True
        
        # Allow users to access their own requests
        if ptype in ["read", "write"]:
            if self.assigned_to == user:
                return True
        
        return False

@frappe.whitelist()
def check_overdue_items():
    """Check for overdue design items and send notifications"""
    try:
        # Get overdue items (older than 7 days and not completed)
        overdue_items = frappe.db.sql("""
            SELECT di.name, di.item_code, di.item_name, dr.name as request_id, 
                   dr.customer_name, dr.assigned_to, dr.request_date
            FROM `tabDesign Request Item` di
            INNER JOIN `tabDesign Request` dr ON di.parent = dr.name
            WHERE dr.docstatus = 0 AND di.design_status != 'Completed'
            AND DATEDIFF(CURDATE(), dr.request_date) > 7
        """, as_dict=True)
        
        if overdue_items:
            # Send notifications for overdue items
            for item in overdue_items:
                if item.assigned_to:
                    frappe.sendmail(
                        recipients=[item.assigned_to],
                        subject=f"Overdue Design Item: {item.item_code}",
                        message=f"""
                        <p>Hello,</p>
                        <p>The following design item is overdue:</p>
                        <ul>
                            <li><strong>Item:</strong> {item.item_code} - {item.item_name}</li>
                            <li><strong>Request:</strong> {item.request_id}</li>
                            <li><strong>Customer:</strong> {item.customer_name}</li>
                            <li><strong>Days Overdue:</strong> {(frappe.utils.nowdate() - item.request_date.date()).days}</li>
                        </ul>
                        <p>Please take action to complete this item.</p>
                        """
                    )
            
            frappe.logger().info(f"Sent overdue notifications for {len(overdue_items)} items")
        
        return len(overdue_items)
        
    except Exception as e:
        frappe.log_error(f"Failed to check overdue items: {str(e)}")
        return 0

@frappe.whitelist()
def get_design_request_items(sales_order):
    """Get items from sales order for design request dialog"""
    try:
        sales_order_doc = frappe.get_doc("Sales Order", sales_order)
        items = []
        
        for idx, item in enumerate(sales_order_doc.items, 1):
            item_group = frappe.get_value("Item", item.item_code, "item_group")
            if item_group != "Fabricated Equipment":
                continue

            used_qty = frappe.db.sql("""
                SELECT IFNULL(SUM(dri.qty), 0)
                FROM `tabDesign Request Item Child` dri
                INNER JOIN `tabDesign Request` dr
                    ON dr.name = dri.parent
                WHERE
                    dr.sales_order = %s
                    AND dri.so_detail = %s
                    AND dr.docstatus < 2
            """, (sales_order, item.name), as_dict=False)[0][0]

            remaining_qty = item.qty - used_qty
            if remaining_qty <= 0:
                continue

            items.append({
                "idx": idx,
                "item_code": item.item_code,
                "item_name": item.item_name,
                "description": item.description or "",
                "qty": remaining_qty,
                "uom": item.uom,
                "so_detail": item.name,
                "parent": sales_order
            })
        
        return items
        
    except Exception as e:
        frappe.log_error(f"Failed to get design request items: {str(e)}")
        frappe.throw(f"Failed to get design request items: {str(e)}")

import json
from frappe.utils import flt
@frappe.whitelist()
def create_design_request_from_sales_order(sales_order, selected_items=None):
    """Create a design request from sales order"""
    try:
        sales_order_doc = frappe.get_doc("Sales Order", sales_order)
        selected_items = json.loads(selected_items)

        used_map = frappe.db.sql("""
            SELECT
                dri.so_detail,
                SUM(dri.qty) AS used_qty
            FROM `tabDesign Request Item Child` dri
            INNER JOIN `tabDesign Request` dr
                ON dr.name = dri.parent
            WHERE
                dr.sales_order = %s
                AND dr.docstatus < 2
            GROUP BY dri.so_detail
        """, sales_order, as_dict=True)

        used_qty_map = {
            row.so_detail: row.used_qty
            for row in used_map
        }
        
        # Create design request
        design_request = frappe.new_doc("Design Request")
        design_request.sales_order = sales_order
        design_request.project = sales_order_doc.project
        design_request.customer = sales_order_doc.customer
        design_request.customer_name = sales_order_doc.customer_name
        
        if sales_order_doc.project:
            project = frappe.get_doc("Project", sales_order_doc.project)
            design_request.project_name = project.project_name
        
        for row in selected_items:
            requested_qty = flt(row.get("qty", 0))
            if requested_qty <= 0:
                continue

            so_item = frappe.get_doc("Sales Order Item", row["so_detail"])

            frappe.db.sql(
                    "SELECT name FROM `tabSales Order Item` WHERE name = %s FOR UPDATE",
                    so_item.name
                )

            used_qty = used_qty_map.get(so_item.name, 0)
            remaining_qty = so_item.qty - used_qty

            if requested_qty > remaining_qty:
                frappe.throw(
                    f"Requested qty {requested_qty} exceeds remaining qty {remaining_qty} "
                    f"for item {so_item.item_code}"
                )

            design_request.append("items", {
                "item_code": so_item.item_code,
                "item_name": so_item.item_name,
                "description": so_item.description,
                "qty": requested_qty,
                "uom": so_item.uom,
                "design_status": "Pending",
                "so_detail": so_item.name
            })

        if not design_request.items:
            frappe.throw("No valid items to create Design Request")  
        
        # Save the design request (autoname will be called automatically)
        design_request.insert()
        frappe.logger().info(f"Design request saved with name: {design_request.name}")

        # Create standalone Design Request Item docs for list view
        for child in design_request.items:
            item_doc = frappe.new_doc("Design Request Item")
            item_doc.item_code = child.item_code
            item_doc.item_name = child.item_name
            item_doc.description = child.description
            item_doc.qty = child.qty
            item_doc.uom = child.uom
            item_doc.design_status = child.design_status
            item_doc.approval_status = child.approval_status
            item_doc.design_request = design_request.name
            item_doc.company = design_request.company or frappe.defaults.get_global_default("company")
            item_doc.insert(ignore_permissions=True)
            # link back

        
        # Verify items were saved
        
        frappe.msgprint(f"Design Request {design_request.name} created successfully with {len(design_request.items)} items")
        return design_request.name
        
    except Exception as e:
        frappe.log_error(f"Failed to create design request: {str(e)}")
        frappe.throw(f"Failed to create design request: {str(e)}")

@frappe.whitelist()
def get_all_design_items(filters=None, sort_by="creation", sort_order="desc"):
    """Get all design items for dashboard view"""
    try:
        # Build filters
        filter_conditions = []
        
        if filters:
            if filters.get("status"):
                filter_conditions.append(f"di.design_status = '{filters['status']}'")
            if filters.get("customer"):
                filter_conditions.append(f"dr.customer_name LIKE '%{filters['customer']}%'")
            if filters.get("sales_order"):
                filter_conditions.append(f"dr.sales_order LIKE '%{filters['sales_order']}%'")
            if filters.get("assigned_to"):
                filter_conditions.append(f"dr.assigned_to = '{filters['assigned_to']}'")
            if filters.get("project"):
                filter_conditions.append(f"dr.project_name LIKE '%{filters['project']}%'")
            if filters.get("item_code"):
                filter_conditions.append(f"di.item_code LIKE '%{filters['item_code']}%'")
            if filters.get("item_name"):
                filter_conditions.append(f"di.item_name LIKE '%{filters['item_name']}%'")
        
        # Build the query
        query = """
            SELECT 
                di.name as item_id,
                dr.name as request_id,
                dr.sales_order,
                dr.project,
                dr.project_name,
                dr.customer,
                dr.customer_name,
                dr.assigned_to,
                dr.status as request_status,
                dr.priority,
                dr.request_date,
                dr.expected_completion,
                di.item_code,
                di.item_name,
                di.description,
                di.qty,
                di.uom,
                di.rate,
                di.amount,
                di.design_status,
                di.current_stage,
                di.approval_status,
                di.sku_generated,
                di.item_created,
                di.bom_created,
                di.nesting_completed,
                di.new_item_code,
                di.bom_name,
                di.idx
            FROM `tabDesign Request Item` di
            INNER JOIN `tabDesign Request` dr ON di.parent = dr.name
            WHERE dr.docstatus = 0
        """
        
        if filter_conditions:
            query += " AND " + " AND ".join(filter_conditions)
        
        # Add sorting
        if sort_by == "creation":
            query += f" ORDER BY dr.creation {sort_order}"
        elif sort_by == "status":
            query += f" ORDER BY di.design_status {sort_order}"
        elif sort_by == "customer":
            query += f" ORDER BY dr.customer_name {sort_order}"
        elif sort_by == "sales_order":
            query += f" ORDER BY dr.sales_order {sort_order}"
        elif sort_by == "assigned_to":
            query += f" ORDER BY dr.assigned_to {sort_order}"
        elif sort_by == "priority":
            query += f" ORDER BY dr.priority {sort_order}"
        elif sort_by == "request_date":
            query += f" ORDER BY dr.request_date {sort_order}"
        else:
            query += f" ORDER BY dr.creation {sort_order}"
        
        items = frappe.db.sql(query, as_dict=True)
        
        # Add additional computed fields
        for item in items:
            item["days_since_request"] = (frappe.utils.nowdate() - item["request_date"].date()).days if item["request_date"] else 0
            item["is_overdue"] = item["days_since_request"] > 7  # Consider overdue after 7 days
        
        return items
        
    except Exception as e:
        frappe.log_error(f"Failed to get design items: {str(e)}")
        frappe.throw(f"Failed to get design items: {str(e)}")

@frappe.whitelist()
def update_item_status(item_id, new_status):
    """Update individual item status"""
    try:
        item = frappe.get_doc("Design Request Item", item_id)
        
        # Validate role permissions
        user_roles = frappe.get_roles(frappe.session.user)
        allowed_statuses = []
        
        role_permissions = {
            "Project Manager": ["Approval Drawing", "Send for Approval", "Design"],
            "Project User": ["Approval Drawing", "Send for Approval", "Design"],
            "Design Manager": ["Send for Approval", "Modelling", "Production Drawing", "BOM", "Nesting"],
            "Design User": ["Send for Approval", "Modelling", "Production Drawing", "BOM", "Nesting"]
        }
        
        for role in user_roles:
            if role in role_permissions:
                allowed_statuses.extend(role_permissions[role])
        
        if new_status not in allowed_statuses and frappe.session.user != "Administrator":
            frappe.throw(_("You don't have permission to set status to {0}").format(new_status))
        
        # Log the transition
        old_status = item.design_status
        item.design_status = new_status
        item.current_stage = new_status
        
        # Handle special status transitions
        if new_status == "SKU Generation":
            item.sku_generated = 1
            # Create or link item
            create_or_link_item(item)
        elif new_status == "BOM":
            item.bom_created = 1
            # Create BOM
            create_bom_for_item(item)
        elif new_status == "Nesting":
            item.nesting_completed = 1
        elif new_status == "Completed":
            item.completion_date = now_datetime()
        
        # Log stage transition
        item.append("stage_transition_log", {
            "stage": "Design Item",
            "from_status": old_status,
            "to_status": new_status,
            "transition_date": now_datetime(),
            "transitioned_by": frappe.session.user,
            "remarks": f"Status changed to {new_status}"
        })
        
        item.save()
        
        # Check if parent request should be completed
        parent = frappe.get_doc("Design Request", item.parent)
        parent.check_completion_status()
        
        frappe.msgprint(f"Item status updated to {new_status}")
        return True
        
    except Exception as e:
        frappe.log_error(f"Failed to update item status: {str(e)}")
        frappe.throw(f"Failed to update item status: {str(e)}")

def create_or_link_item(item):
    """Create new item or link existing item for SKU generation"""
    try:
        # Check if item is a dummy item (like P-SY-CE-0037)
        if item.item_code.startswith("P-SY-CE-0037"):
            # Create new item based on design specifications
            new_item_code = generate_new_item_code(item)
            
            # Create new item
            new_item = frappe.new_doc("Item")
            new_item.item_code = new_item_code
            new_item.item_name = item.item_name
            new_item.description = item.description
            new_item.item_group = "Products"
            new_item.stock_uom = item.uom
            new_item.is_stock_item = 1
            new_item.insert()
            
            # Update the design item
            item.new_item_code = new_item_code
            item.item_created = 1
            
            frappe.msgprint(f"New item {new_item_code} created successfully")
        else:
            # Link to existing item
            item.new_item_code = item.item_code
            item.item_created = 1
            
    except Exception as e:
        frappe.log_error(f"Failed to create/link item: {str(e)}")
        frappe.throw(f"Failed to create/link item: {str(e)}")

def generate_new_item_code(item):
    """Generate new item code based on design specifications"""
    # This is a simple implementation - you can enhance based on your naming convention
    base_code = "FG-DESIGN"
    timestamp = frappe.utils.now_datetime().strftime("%Y%m%d%H%M%S")
    return f"{base_code}-{timestamp}"

def create_bom_for_item(item):
    """Create BOM for the item"""
    try:
        if not item.new_item_code:
            frappe.throw("Item must be created before creating BOM")
        
        # Create BOM
        bom = frappe.new_doc("BOM")
        bom.item = item.new_item_code
        bom.item_name = item.item_name
        bom.uom = item.uom
        bom.quantity = 1
        bom.is_default = 1
        bom.is_active = 1
        
        # Add BOM items (you can customize this based on your requirements)
        # For now, we'll create a simple BOM with the original item as component
        bom.append("items", {
            "item_code": item.item_code,
            "qty": item.qty,
            "uom": item.uom
        })
        
        bom.insert()
        
        # Update the design item
        item.bom_name = bom.name
        
        # Update the item's default BOM
        frappe.db.set_value("Item", item.new_item_code, "default_bom", bom.name)
        
        frappe.msgprint(f"BOM {bom.name} created successfully for item {item.new_item_code}")
        
    except Exception as e:
        frappe.log_error(f"Failed to create BOM: {str(e)}")
        frappe.throw(f"Failed to create BOM: {str(e)}")

@frappe.whitelist()
def get_dashboard_stats():
    """Get dashboard statistics for design requests"""
    stats = {
        "total_requests": frappe.db.count("Design Request"),
        "open_requests": frappe.db.count("Design Request", {"status": "Open"}),
        "closed_requests": frappe.db.count("Design Request", {"status": "Closed"}),
        "my_requests": frappe.db.count("Design Request", {"assigned_to": frappe.session.user}),
        "total_items": frappe.db.count("Design Request Item"),
        "pending_items": frappe.db.count("Design Request Item", {"design_status": "Pending"}),
        "completed_items": frappe.db.count("Design Request Item", {"design_status": "Completed"}),
        "overdue_items": frappe.db.sql("""
            SELECT COUNT(*) FROM `tabDesign Request Item` di
            INNER JOIN `tabDesign Request` dr ON di.parent = dr.name
            WHERE dr.docstatus = 0 AND di.design_status != 'Completed'
            AND DATEDIFF(CURDATE(), dr.request_date) > 7
        """)[0][0]
    }
    return stats

@frappe.whitelist()
def update_design_status(design_request, new_status):
    """Update design request status"""
    try:
        doc = frappe.get_doc("Design Request", design_request)
        doc.update_design_status(new_status)
        return True
    except Exception as e:
        frappe.log_error(f"Failed to update design status: {str(e)}")
        frappe.throw(f"Failed to update design status: {str(e)}")

@frappe.whitelist()
def assign_to_user(design_request, user):
    """Assign design request to user"""
    try:
        doc = frappe.get_doc("Design Request", design_request)
        doc.assign_to_user(user)
        return True
    except Exception as e:
        frappe.log_error(f"Failed to assign design request: {str(e)}")
        frappe.throw(f"Failed to assign design request: {str(e)}")

@frappe.whitelist()
def add_comment(design_request, comment):
    """Add comment to design request"""
    try:
        doc = frappe.get_doc("Design Request", design_request)
        doc.add_comment(comment)
        return True
    except Exception as e:
        frappe.log_error(f"Failed to add comment: {str(e)}")
        frappe.throw(f"Failed to add comment: {str(e)}")

@frappe.whitelist()
def get_recent_requests(limit=10):
    """Get recent design requests"""
    requests = frappe.get_all(
        "Design Request",
        fields=["name", "sales_order", "project_name", "customer_name", "status", "priority", "assigned_to", "request_date"],
        order_by="creation desc",
        limit=limit
    )
    return requests

@frappe.whitelist()
def get_request_details(request_name):
    """Get detailed information about a design request"""
    request = frappe.get_doc("Design Request", request_name)
    return {
        "name": request.name,
        "sales_order": request.sales_order,
        "project": request.project,
        "project_name": request.project_name,
        "customer": request.customer,
        "customer_name": request.customer_name,
        "status": request.status,
        "priority": request.priority,
        "assigned_to": request.assigned_to,
        "assigned_date": request.assigned_date,
        "request_date": request.request_date,
        "expected_completion": request.expected_completion,
        "actual_completion": request.actual_completion,
        "remarks": request.remarks,
        "items": [{
            "item_code": item.item_code,
            "item_name": item.item_name,
            "description": item.description,
            "qty": item.qty,
            "uom": item.uom,
            "rate": item.rate,
            "amount": item.amount,
            "design_status": item.design_status
        } for item in request.items]
    } 

@frappe.whitelist()
def test_design_request_data(design_request_name):
    """Test function to verify design request data"""
    try:
        doc = frappe.get_doc("Design Request", design_request_name)
        result = {
            "name": doc.name,
            "items_count": len(doc.items),
            "items": []
        }
        
        for item in doc.items:
            result["items"].append({
                "item_code": item.item_code,
                "item_name": item.item_name,
                "design_status": item.design_status
            })
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Failed to get design request data: {str(e)}")
        return {"error": str(e)} 

@frappe.whitelist()
def get_design_stages_chart_data():
    """Get data for design stages chart"""
    try:
        # Get count of items by design status
        stages_data = frappe.db.sql("""
            SELECT 
                design_status,
                COUNT(*) as count
            FROM `tabDesign Request Item`
            WHERE design_status IS NOT NULL
            GROUP BY design_status
            ORDER BY count DESC
        """, as_dict=True)
        
        # Format data for chart
        chart_data = {
            "labels": [item.design_status for item in stages_data],
            "datasets": [{
                "name": "Items by Stage",
                "values": [item.count for item in stages_data]
            }]
        }
        
        return chart_data
        
    except Exception as e:
        frappe.log_error(f"Failed to get design stages chart data: {str(e)}")
        return {"labels": [], "datasets": []}

@frappe.whitelist()
def get_design_requests_chart_data():
    """Get data for design requests chart"""
    try:
        # Get count of design requests by status
        requests_data = frappe.db.sql("""
            SELECT 
                status,
                COUNT(*) as count
            FROM `tabDesign Request`
            WHERE status IS NOT NULL
            GROUP BY status
            ORDER BY count DESC
        """, as_dict=True)
        
        # Format data for chart
        chart_data = {
            "labels": [item.status for item in requests_data],
            "datasets": [{
                "name": "Design Requests by Status",
                "values": [item.count for item in requests_data]
            }]
        }
        
        return chart_data
        
    except Exception as e:
        frappe.log_error(f"Failed to get design requests chart data: {str(e)}")
        return {"labels": [], "datasets": []} 