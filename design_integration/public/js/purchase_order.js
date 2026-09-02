frappe.ui.form.on("Purchase Order", {
	refresh(frm) {
		set_subcontract_service_item_query(frm);
		render_subcontract_rm_summary(frm);
	},

	custom_subcontract_service_item(frm) {
		set_subcontract_service_item_query(frm);
	},

	custom_apply_subcontract_service(frm) {
		apply_subcontract_service_item(frm);
	},
});

frappe.ui.form.on("Purchase Order Item", {
	item_code(frm) {
		render_subcontract_rm_summary(frm);
	},

	fg_item(frm) {
		render_subcontract_rm_summary(frm);
	},

	fg_item_qty(frm) {
		render_subcontract_rm_summary(frm);
	},

	qty(frm) {
		render_subcontract_rm_summary(frm);
	},

	items_remove(frm) {
		render_subcontract_rm_summary(frm);
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
	render_subcontract_rm_summary(frm);
	frappe.show_alert({
		message: __("Updated item code and rate in {0} row(s).", [rows.length]),
		indicator: "green",
	});
}

function parse_subcontract_rm_details(row) {
	if (!row.custom_subcontract_raw_materials) return [];

	try {
		return JSON.parse(row.custom_subcontract_raw_materials) || [];
	} catch (e) {
		return [];
	}
}

function get_po_subcontract_rm_rows(frm) {
	const rows = [];
	(frm.doc.items || []).forEach((po_row) => {
		parse_subcontract_rm_details(po_row).forEach((rm) => {
			if (!rm.item_code) return;
			rows.push({
				service_item: po_row.item_code,
				fg_item: po_row.fg_item || po_row.custom_fg_item,
				fg_qty: po_row.fg_item_qty || po_row.custom_fg_item_qty,
				rm_item: rm.item_code,
				rm_name: rm.item_name || rm.description || "",
				qty: flt(rm.qty),
				uom: rm.stock_uom || "",
			});
		});
	});
	return rows;
}

function render_subcontract_rm_summary(frm) {
	const field = frm.fields_dict.custom_subcontract_rm_summary;
	if (!field) return;

	if (!frm.doc.is_subcontracted) {
		field.$wrapper.empty();
		return;
	}

	const rows = get_po_subcontract_rm_rows(frm);
	if (!rows.length) {
		field.$wrapper.html(`<div class="text-muted">${__("Save the subcontracting Purchase Order to fetch raw materials from BOM.")}</div>`);
		return;
	}

	const html = rows.map((row) => `
		<tr>
			<td>${frappe.utils.escape_html(row.service_item || "")}</td>
			<td>${frappe.utils.escape_html(row.fg_item || "")}</td>
			<td class="text-right">${format_number(row.fg_qty || 0)}</td>
			<td>${frappe.utils.escape_html(row.rm_item)}</td>
			<td>${frappe.utils.escape_html(row.rm_name)}</td>
			<td class="text-right">${format_number(row.qty)}</td>
			<td>${frappe.utils.escape_html(row.uom)}</td>
		</tr>
	`).join("");

	field.$wrapper.html(`
		<table class="table table-bordered table-condensed" style="margin-bottom: 8px">
			<thead>
				<tr>
					<th>${__("Service Item")}</th>
					<th>${__("FG Item")}</th>
					<th class="text-right">${__("FG Qty")}</th>
					<th>${__("Raw Material")}</th>
					<th>${__("Raw Material Name")}</th>
					<th class="text-right">${__("RM Qty")}</th>
					<th>${__("UOM")}</th>
				</tr>
			</thead>
			<tbody>${html}</tbody>
		</table>
	`);
}
