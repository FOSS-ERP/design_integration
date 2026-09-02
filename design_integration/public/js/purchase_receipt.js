frappe.ui.form.on("Purchase Receipt", {
	refresh(frm) {
		render_subcontract_rm_rate_summary(frm);
	},

	is_subcontracted(frm) {
		render_subcontract_rm_rate_summary(frm);
	},

	custom_apply_subcontract_rm_rates(frm) {
		apply_subcontract_rm_rates(frm);
	},
});

frappe.ui.form.on("Purchase Receipt Item", {
	item_code(frm) {
		render_subcontract_rm_rate_summary(frm);
	},

	qty(frm) {
		render_subcontract_rm_rate_summary(frm);
	},

	custom_subcontract_raw_materials(frm) {
		render_subcontract_rm_rate_summary(frm);
	},

	items_remove(frm) {
		render_subcontract_rm_rate_summary(frm);
	},
});

function parse_pr_subcontract_rm_details(row) {
	if (!row.custom_subcontract_raw_materials) return [];

	try {
		return JSON.parse(row.custom_subcontract_raw_materials) || [];
	} catch (e) {
		return [];
	}
}

function get_pr_rm_totals(frm) {
	const totals = {};
	(frm.doc.items || []).forEach((row) => {
		parse_pr_subcontract_rm_details(row).forEach((rm) => {
			if (!rm.item_code) return;

			if (!totals[rm.item_code]) {
				totals[rm.item_code] = {
					item_code: rm.item_code,
					item_name: rm.item_name || rm.description || "",
					stock_uom: rm.stock_uom || "",
					qty: 0,
				};
			}

			totals[rm.item_code].qty += flt(rm.qty);
		});
	});

	return Object.values(totals).sort((a, b) => a.item_code.localeCompare(b.item_code));
}

function render_subcontract_rm_rate_summary(frm) {
	const field = frm.fields_dict.custom_subcontract_rm_rate_summary;
	if (!field) return;

	if (!frm.doc.is_subcontracted) {
		field.$wrapper.empty();
		return;
	}

	const totals = get_pr_rm_totals(frm);
	if (!totals.length) {
		field.$wrapper.html(`<div class="text-muted">${__("Save the subcontracting Purchase Receipt to fetch raw materials from BOM.")}</div>`);
		return;
	}

	const rows = totals.map((row) => `
		<tr>
			<td>${frappe.utils.escape_html(row.item_code)}</td>
			<td>${frappe.utils.escape_html(row.item_name)}</td>
			<td class="text-right">${format_number(row.qty)}</td>
			<td>${frappe.utils.escape_html(row.stock_uom)}</td>
			<td>
				<input class="form-control input-sm subcontract-rm-rate"
					data-item-code="${frappe.utils.escape_html(row.item_code)}"
					type="number"
					step="any"
					value="">
			</td>
		</tr>
	`).join("");

	field.$wrapper.html(`
		<table class="table table-bordered table-condensed" style="margin-bottom: 8px">
			<thead>
				<tr>
					<th>${__("Raw Material")}</th>
					<th>${__("Raw Material Name")}</th>
					<th class="text-right">${__("Total Qty")}</th>
					<th>${__("UOM")}</th>
					<th>${__("Amount")}</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>
	`);
}

async function apply_subcontract_rm_rates(frm) {
	if (!frm.doc.is_subcontracted) {
		frappe.msgprint(__("This action is only for subcontracting Purchase Receipts."));
		return;
	}

	const field = frm.fields_dict.custom_subcontract_rm_rate_summary;
	if (!field) return;

	const amounts = {};
	field.$wrapper.find(".subcontract-rm-rate").each(function () {
		const item_code = $(this).data("item-code");
		const amount = flt($(this).val());
		if (item_code && amount) {
			amounts[item_code] = amount;
		}
	});

	if (!Object.keys(amounts).length) {
		frappe.msgprint(__("Enter at least one raw material amount."));
		return;
	}

	const total_qty_by_item = {};
	(frm.doc.items || []).forEach((row) => {
		parse_pr_subcontract_rm_details(row).forEach((rm) => {
			if (!rm.item_code || !amounts[rm.item_code]) return;
			total_qty_by_item[rm.item_code] = flt(total_qty_by_item[rm.item_code]) + flt(rm.qty);
		});
	});

	let updated = 0;
	for (const row of frm.doc.items || []) {
		const materials = parse_pr_subcontract_rm_details(row);
		const row_qty_by_item = {};

		materials.forEach((rm) => {
			if (!rm.item_code || !amounts[rm.item_code]) return;
			row_qty_by_item[rm.item_code] = flt(row_qty_by_item[rm.item_code]) + flt(rm.qty);
		});

		let row_amount = 0;
		Object.entries(row_qty_by_item).forEach(([item_code, row_rm_qty]) => {
			const total_rm_qty = flt(total_qty_by_item[item_code]);
			if (!total_rm_qty) return;
			row_amount += flt(amounts[item_code]) * flt(row_rm_qty) / total_rm_qty;
		});

		if (row_amount > 0 && flt(row.qty) > 0) {
			const rate = row_amount / flt(row.qty);
			const amount = row_amount;
			await frappe.model.set_value(row.doctype, row.name, {
				rate,
				base_rate: rate,
				net_rate: rate,
				base_net_rate: rate,
				stock_uom_rate: rate,
				amount,
				base_amount: amount,
				net_amount: amount,
				base_net_amount: amount,
			});
			updated += 1;
		}
	}

	frm.refresh_field("items");
	frm.trigger("calculate_taxes_and_totals");
	frappe.show_alert({
		message: __("Applied raw material amounts to {0} Purchase Receipt row(s).", [updated]),
		indicator: "green",
	});
}
