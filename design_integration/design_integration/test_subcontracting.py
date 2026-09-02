import json
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

from design_integration.design_integration import subcontracting


class Row(SimpleNamespace):
	def get(self, key, default=None):
		return getattr(self, key, default)


class Doc(SimpleNamespace):
	def get(self, key, default=None):
		return getattr(self, key, default)


class Meta:
	def __init__(self, fields):
		self.fields = set(fields)

	def has_field(self, fieldname):
		return fieldname in self.fields


class TestSubcontractingRawMaterialDetails(TestCase):
	def test_get_subcontract_raw_materials_combines_same_raw_material(self):
		rows = [
			{
				"item_code": "RM-1",
				"item_name": "Sheet 1",
				"description": "Sheet 1",
				"stock_uom": "Kg",
				"qty_consumed_per_unit": 2,
			},
			{
				"item_code": "RM-1",
				"item_name": "Sheet 1",
				"description": "Sheet 1",
				"stock_uom": "Kg",
				"qty_consumed_per_unit": 3,
			},
			{
				"item_code": "RM-2",
				"item_name": "Nut",
				"description": "Nut",
				"stock_uom": "Nos",
				"qty_consumed_per_unit": 4,
			},
		]

		frappe = SimpleNamespace(
			db=SimpleNamespace(get_value=Mock(return_value="BOM-FG-001"), exists=Mock(return_value=True)),
			get_all=Mock(return_value=rows),
			throw=Mock(side_effect=Exception),
		)
		with patch.object(subcontracting, "frappe", frappe):
			materials = subcontracting.get_subcontract_raw_materials.__wrapped__("FG-001", "BOM-FG-001", 2)

		self.assertEqual(len(materials), 2)
		self.assertEqual(materials[0]["item_code"], "RM-1")
		self.assertEqual(materials[0]["qty_per_unit"], 5)
		self.assertEqual(materials[0]["qty"], 10)
		self.assertEqual(materials[1]["item_code"], "RM-2")
		self.assertEqual(materials[1]["qty"], 8)

	def test_purchase_order_sync_stores_fg_and_raw_material_details_per_row(self):
		row = Row(
			item_code="SERVICE-001",
			fg_item="FG-001",
			fg_item_qty=3,
			qty=1,
			bom="BOM-FG-001",
			include_exploded_items=1,
			meta=Meta(["custom_fg_item", "custom_fg_item_qty", "custom_subcontract_raw_materials"]),
		)
		doc = Doc(doctype="Purchase Order", is_subcontracted=1, items=[row])

		with patch.object(
			subcontracting,
			"get_subcontract_raw_materials",
			return_value=[{"item_code": "RM-1", "qty": 6, "qty_per_unit": 2}],
		) as get_materials:
			subcontracting.sync_subcontract_raw_material_details(doc)

		get_materials.assert_called_once_with("FG-001", "BOM-FG-001", 3, 1)
		self.assertEqual(row.custom_fg_item, "FG-001")
		self.assertEqual(row.custom_fg_item_qty, 3)
		self.assertEqual(json.loads(row.custom_subcontract_raw_materials)[0]["qty"], 6)

	def test_purchase_receipt_sync_converts_service_qty_back_to_fg_qty(self):
		row = Row(
			item_code="SERVICE-001",
			qty=0.5,
			bom="BOM-FG-001",
			purchase_order_item="POI-001",
			include_exploded_items=1,
			meta=Meta(["custom_fg_item", "custom_fg_item_qty", "custom_subcontract_raw_materials"]),
		)
		doc = Doc(doctype="Purchase Receipt", is_subcontracted=1, items=[row])
		po_values = {
			"fg_item": "FG-001",
			"fg_item_qty": 10,
			"qty": 2,
			"custom_fg_item": None,
			"custom_fg_item_qty": None,
			"custom_subcontract_raw_materials": "",
		}

		frappe = SimpleNamespace(db=SimpleNamespace(get_value=Mock(return_value=po_values)))
		with patch.object(subcontracting, "frappe", frappe), \
			patch.object(
				subcontracting,
				"get_subcontract_raw_materials",
				return_value=[{"item_code": "RM-1", "qty": 5, "qty_per_unit": 2}],
			) as get_materials:
			subcontracting.sync_subcontract_raw_material_details(doc)

		get_materials.assert_called_once_with("FG-001", "BOM-FG-001", 2.5, 1)
		self.assertEqual(row.custom_fg_item, "FG-001")
		self.assertEqual(row.custom_fg_item_qty, 2.5)
		self.assertEqual(json.loads(row.custom_subcontract_raw_materials)[0]["item_code"], "RM-1")
