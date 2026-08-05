frappe.ui.form.on("Stock Entry", {
	refresh(frm) {
		render_subcontract_item_summary(frm);
	},

	purpose(frm) {
		render_subcontract_item_summary(frm);
	},

	stock_entry_type(frm) {
		render_subcontract_item_summary(frm);
	},

	custom_apply_subcontract_item_summary(frm) {
		apply_subcontract_item_summary(frm);
	},
});

frappe.ui.form.on("Stock Entry Detail", {
	item_code(frm) {
		render_subcontract_item_summary(frm);
	},

	qty(frm) {
		render_subcontract_item_summary(frm);
	},

	items_remove(frm) {
		render_subcontract_item_summary(frm);
	},
});

function is_send_to_subcontractor(frm) {
	return frm.doc.purpose === "Send to Subcontractor" || frm.doc.stock_entry_type === "Send to Subcontractor";
}

function get_subcontract_item_totals(frm) {
	const totals = {};
	(frm.doc.items || []).forEach((row) => {
		if (!row.item_code) return;
		totals[row.item_code] = flt(totals[row.item_code]) + flt(row.qty);
	});
	return totals;
}

function render_subcontract_item_summary(frm) {
	const field = frm.fields_dict.custom_subcontract_item_summary;
	if (!field) return;

	if (!is_send_to_subcontractor(frm)) {
		field.$wrapper.empty();
		return;
	}

	const totals = get_subcontract_item_totals(frm);
	const items = Object.keys(totals).sort();
	if (!items.length) {
		field.$wrapper.html(`<div class="text-muted">${__("No item rows found.")}</div>`);
		return;
	}

	const rows = items.map((item_code) => `
		<tr>
			<td style="width: 70%">${frappe.utils.escape_html(item_code)}</td>
			<td style="width: 30%">
				<input class="form-control input-sm subcontract-summary-qty"
					data-item-code="${frappe.utils.escape_html(item_code)}"
					type="number"
					step="any"
					value="${flt(totals[item_code])}">
			</td>
		</tr>
	`).join("");

	field.$wrapper.html(`
		<table class="table table-bordered table-condensed" style="margin-bottom: 8px">
			<thead>
				<tr>
					<th>${__("Item Code")}</th>
					<th>${__("Total Qty")}</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>
	`);
}

async function apply_subcontract_item_summary(frm) {
	if (!is_send_to_subcontractor(frm)) {
		frappe.msgprint(__("This action is only for Send to Subcontractor Stock Entries."));
		return;
	}

	const field = frm.fields_dict.custom_subcontract_item_summary;
	if (!field) return;

	const target_by_item = {};
	field.$wrapper.find(".subcontract-summary-qty").each(function () {
		const item_code = $(this).data("item-code");
		target_by_item[item_code] = flt($(this).val());
	});

	for (const [item_code, target_qty] of Object.entries(target_by_item)) {
		await distribute_item_qty(frm, item_code, target_qty);
	}

	frm.refresh_field("items");
	render_subcontract_item_summary(frm);
	frappe.show_alert({
		message: __("Updated Stock Entry item quantities."),
		indicator: "green",
	});
}

async function distribute_item_qty(frm, item_code, target_qty) {
	const rows = (frm.doc.items || []).filter((row) => row.item_code === item_code);
	if (!rows.length) return;

	let remaining = flt(target_qty);
	for (const row of rows) {
		const original_qty = flt(row.qty);
		let next_qty = 0;

		if (remaining > 0) {
			next_qty = Math.min(original_qty, remaining);
			remaining -= next_qty;
		}

		await frappe.model.set_value(row.doctype, row.name, "qty", next_qty);
	}

	if (remaining > 0) {
		const last_row = rows[rows.length - 1];
		await frappe.model.set_value(last_row.doctype, last_row.name, "qty", flt(last_row.qty) + remaining);
	}
}
