# -*- coding: utf-8 -*-
# Copyright (c) 2025, AxelGear and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _

# App configuration
app_name = "design_integration"
app_title = "Design Integration"
app_publisher = "Axelgear"
app_description = "Design Integration"
app_email = "rejithr1995@gmail.com"
app_license = "mit"

# App include JS
app_include_js = [
    "/assets/design_integration/js/design_integration.js",
    "/assets/design_integration/js/design_items_dashboard.js",
    "/assets/design_integration/js/design_tasks_page.js",
    "/assets/design_integration/js/design_request_item_form.js",
    "/assets/design_integration/js/design_dashboard.js"
]

# Scheduled Tasks
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
        "role": "System Manager",
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
        "export": 1,
        "share": 1,
        "report": 1,
        "email": 1,
        "set_user_permissions": 1
    },
    {
        "doctype": "Design Request Item",
        "role": "System Manager",
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
        "export": 1,
        "share": 1,
        "report": 1,
        "email": 1,
        "set_user_permissions": 1
    }
]

