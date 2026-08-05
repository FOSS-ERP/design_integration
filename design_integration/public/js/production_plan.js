frappe.ui.form.on("Production Plan", {
	refresh(frm) {
		refresh_sub_assembly_filter(frm);
	},

	custom_sub_assembly_item_name_filter(frm) {
		refresh_sub_assembly_filter(frm);
	},

	custom_sub_assembly_manufacturing_type(frm) {
		refresh_sub_assembly_filter(frm);
	},

	custom_sub_assembly_supplier(frm) {
		refresh_sub_assembly_filter(frm);
	},

	custom_apply_sub_assembly_updates(frm) {
		apply_sub_assembly_updates(frm);
	},

	sub_assembly_items_add(frm) {
		refresh_sub_assembly_filter(frm);
	},
});

frappe.ui.form.on("Production Plan Sub Assembly Item", {
	item_name(frm) {
		refresh_sub_assembly_filter(frm);
	},

	production_item(frm) {
		refresh_sub_assembly_filter(frm);
	},

	type_of_manufacturing(frm) {
		refresh_sub_assembly_filter(frm);
	},

	supplier(frm) {
		refresh_sub_assembly_filter(frm);
	},
});

function get_matching_sub_assembly_rows(frm) {
	const item_filter = (frm.doc.custom_sub_assembly_item_name_filter || "").trim().toLowerCase();
	const manufacturing_type = frm.doc.custom_sub_assembly_manufacturing_type || "";

	return (frm.doc.sub_assembly_items || []).filter((row) => {
		const row_text = `${row.item_name || ""} ${row.production_item || ""}`.toLowerCase();
		const item_matches = !item_filter || row_text.includes(item_filter);
		const type_matches = !manufacturing_type || row.type_of_manufacturing === manufacturing_type;
		return item_matches && type_matches;
	});
}

function refresh_sub_assembly_filter(frm) {
	if (!frm.fields_dict.sub_assembly_items || !frm.fields_dict.sub_assembly_items.grid) return;

	const matching_names = new Set(get_matching_sub_assembly_rows(frm).map((row) => row.name));
	const has_filter = Boolean(
		(frm.doc.custom_sub_assembly_item_name_filter || "").trim() ||
		frm.doc.custom_sub_assembly_manufacturing_type
	);

	frm.fields_dict.sub_assembly_items.grid.grid_rows.forEach((grid_row) => {
		const show = !has_filter || matching_names.has(grid_row.doc.name);
		grid_row.wrapper.toggle(show);
	});
}

async function apply_sub_assembly_updates(frm) {
	const manufacturing_type = frm.doc.custom_sub_assembly_manufacturing_type || "";
	const supplier = frm.doc.custom_sub_assembly_supplier || "";

	if (!manufacturing_type) {
		frappe.msgprint(__("Select Manufacturing Type before applying."));
		return;
	}

	if (manufacturing_type === "Subcontract" && !supplier) {
		frappe.msgprint(__("Select Supplier for Subcontract rows."));
		return;
	}

	const rows = get_matching_sub_assembly_rows(frm);
	if (!rows.length) {
		frappe.msgprint(__("No matching Sub Assembly rows found."));
		return;
	}

	for (const row of rows) {
		await frappe.model.set_value(row.doctype, row.name, "type_of_manufacturing", manufacturing_type);
		await frappe.model.set_value(row.doctype, row.name, "supplier", manufacturing_type === "Subcontract" ? supplier : "");
	}

	frm.refresh_field("sub_assembly_items");
	refresh_sub_assembly_filter(frm);
	frappe.show_alert({
		message: __("Updated {0} Sub Assembly row(s).", [rows.length]),
		indicator: "green",
	});
}
