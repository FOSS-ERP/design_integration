frappe.ui.form.on("Project", {
	status: function (frm) {
		if (frm.doc.status === "On Hold") {
			frm.set_value("percent_complete_method", "Manual");
		}
	},
});
