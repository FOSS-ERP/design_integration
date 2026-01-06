from __future__ import unicode_literals

# -*- coding: utf-8 -*-
# Copyright (c) 2025, AxelGear and contributors
# For license information, please see license.txt

# App configuration
app_name = "design_integration"
app_title = "Design Integration"
app_publisher = "Axelgear"
app_description = "Design Integration"
app_email = "rejithr1995@gmail.com"
app_license = "mit"


# Include JS files
app_include_js = [
	"/assets/design_integration/js/design_integration.js",
	"/assets/design_integration/js/design_tasks_page.js",
	"/assets/design_integration/js/design_request_item_form.js"
]

# Include CSS files
app_include_css = []

## after migrate
after_migrate = "design_integration.design_integration.custom_field.create_custom_fields_on_migrate"

# DocType Events
doc_events = {
	# "Sales Order": {
	# 	"on_submit": "design_integration.design_integration.doctype.design_request.design_request.on_sales_order_submit"
	# }
}

# Scheduler Events
scheduler_events = {
	"daily": [
		"design_integration.design_integration.doctype.design_request.design_request.check_overdue_items"
	]
}

# Fixtures
fixtures = [
	{
		"doctype": "Custom Field",
		"filters": [["module", "=", "Design Integration"]]
	}
]

# Permissions
permissions = [
	{
		"doctype": "Design Request",
		"role": "Design Manager",
		"permlevel": 0,
		"select": 1,
		"read": 1,
		"write": 1,
		"create": 1,
		"delete": 1,
		"submit": 1,
		"cancel": 1,
		"amend": 1,
		"print": 1,
		"email": 1,
		"report": 1,
		"import": 1,
		"export": 1,
		"share": 1,
		"set_user_permissions": 1
	},
	{
		"doctype": "Design Request",
		"role": "Design User",
		"permlevel": 0,
		"select": 1,
		"read": 1,
		"write": 1,
		"create": 1,
		"delete": 0,
		"submit": 0,
		"cancel": 0,
		"amend": 0,
		"print": 1,
		"email": 1,
		"report": 1,
		"import": 0,
		"export": 1,
		"share": 0,
		"set_user_permissions": 0
	},
	{
		"doctype": "Design Request",
		"role": "Project Manager",
		"permlevel": 0,
		"select": 1,
		"read": 1,
		"write": 1,
		"create": 1,
		"delete": 0,
		"submit": 0,
		"cancel": 0,
		"amend": 0,
		"print": 1,
		"email": 1,
		"report": 1,
		"import": 0,
		"export": 1,
		"share": 0,
		"set_user_permissions": 0
	},
	{
		"doctype": "Design Request",
		"role": "Project User",
		"permlevel": 0,
		"select": 1,
		"read": 1,
		"write": 0,
		"create": 0,
		"delete": 0,
		"submit": 0,
		"cancel": 0,
		"amend": 0,
		"print": 1,
		"email": 0,
		"report": 1,
		"import": 0,
		"export": 0,
		"share": 0,
		"set_user_permissions": 0
	},
	{
		"doctype": "Design Request Item",
		"role": "Design Manager",
		"permlevel": 0,
		"select": 1,
		"read": 1,
		"write": 1,
		"create": 1,
		"delete": 1,
		"submit": 1,
		"cancel": 1,
		"amend": 1,
		"print": 1,
		"email": 1,
		"report": 1,
		"import": 1,
		"export": 1,
		"share": 1,
		"set_user_permissions": 1
	},
	{
		"doctype": "Design Request Item",
		"role": "Design User",
		"permlevel": 0,
		"select": 1,
		"read": 1,
		"write": 1,
		"create": 1,
		"delete": 0,
		"submit": 0,
		"cancel": 0,
		"amend": 0,
		"print": 1,
		"email": 1,
		"report": 1,
		"import": 0,
		"export": 1,
		"share": 0,
		"set_user_permissions": 0
	},
	{
		"doctype": "Design Request Item",
		"role": "Project Manager",
		"permlevel": 0,
		"select": 1,
		"read": 1,
		"write": 1,
		"create": 1,
		"delete": 0,
		"submit": 0,
		"cancel": 0,
		"amend": 0,
		"print": 1,
		"email": 1,
		"report": 1,
		"import": 0,
		"export": 1,
		"share": 0,
		"set_user_permissions": 0
	},
	{
		"doctype": "Design Request Item",
		"role": "Project User",
		"permlevel": 0,
		"select": 1,
		"read": 1,
		"write": 0,
		"create": 0,
		"delete": 0,
		"submit": 0,
		"cancel": 0,
		"amend": 0,
		"print": 1,
		"email": 0,
		"report": 1,
		"import": 0,
		"export": 0,
		"share": 0,
		"set_user_permissions": 0
	}
]

# Add to apps screen
add_to_apps_screen = 1

