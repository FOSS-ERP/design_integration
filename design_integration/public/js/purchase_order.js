frappe.ui.form.on("Purchase Order", {
	refresh(frm) {
		set_subcontract_service_item_query(frm);
	},

	custom_subcontract_service_item(frm) {
		set_subcontract_service_item_query(frm);
	},

	custom_apply_subcontract_service(frm) {
		apply_subcontract_service_item(frm);
	},
});

function set_subcontract_service_item_query(frm) {
	if (!frm.fields_dict.custom_subcontract_service_item) return;

	frm.set_query("custom_subcontract_service_item", () => ({
		filters: {
			disabled: 0,
			is_stock_item: 0,
		},
	}));
}

async function apply_subcontract_service_item(frm) {
	if (!frm.doc.is_subcontracted) {
		frappe.msgprint(__("This action is only for subcontracting Purchase Orders."));
		return;
	}

	if (!frm.doc.custom_subcontract_service_item) {
		frappe.msgprint(__("Select an Item Code."));
		return;
	}

	const rate = flt(frm.doc.custom_subcontract_service_rate);
	if (!rate) {
		frappe.msgprint(__("Enter a Rate."));
		return;
	}

	const rows = frm.doc.items || [];
	if (!rows.length) {
		frappe.msgprint(__("No item rows found."));
		return;
	}

	for (const row of rows) {
		const fg_item = row.fg_item;
		const fg_item_qty = row.fg_item_qty;

		await frappe.model.set_value(row.doctype, row.name, "item_code", frm.doc.custom_subcontract_service_item);
		await frappe.model.set_value(row.doctype, row.name, "rate", rate);

		if (fg_item !== row.fg_item) {
			await frappe.model.set_value(row.doctype, row.name, "fg_item", fg_item);
		}
		if (fg_item_qty !== row.fg_item_qty) {
			await frappe.model.set_value(row.doctype, row.name, "fg_item_qty", fg_item_qty);
		}
	}

	frm.refresh_field("items");
	frappe.show_alert({
		message: __("Updated item code and rate in {0} row(s).", [rows.length]),
		indicator: "green",
	});
}
