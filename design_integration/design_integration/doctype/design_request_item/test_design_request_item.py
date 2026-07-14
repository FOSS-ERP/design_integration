import os
import tempfile
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from openpyxl import Workbook

from design_integration.design_integration.doctype.design_request_item import design_request_item as dri


class TestDesignRequestItem(TestCase):
	def make_workbook(self, rows):
		wb = Workbook()
		ws = wb.active
		ws.title = "SUB BOM LIST"
		for row in rows:
			ws.append(row)
		tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
		wb.save(tmp.name)
		tmp.close()
		self.addCleanup(lambda: os.path.exists(tmp.name) and os.unlink(tmp.name))
		return tmp.name

	def test_parse_multiple_sub_assemblies(self):
		path = self.make_workbook([
			["Part No", "Part Name", "Qty", "UOM", "Type"],
			["SA-001", "LEG TUBE ASM", 4, "Nos", "SUB ASSY"],
			["PART-001", "LEG TUBE", 1, "Nos", "PART"],
			["PART-002", "M6 ROUND INSERT", 6, "Nos", "PART"],
			["SA-002", "SHELF ASM", 2, "Nos", "SUB ASSY"],
			["PART-003", "SHELF", 1, "Nos", "PART"],
		])

		parsed = dri._parse_bom_workbook(path, "FG-001")

		self.assertEqual(parsed["fg_item_code"], "FG-001")
		self.assertEqual(parsed["selected_sheet"], "SUB BOM LIST")
		self.assertEqual(len(parsed["assemblies"]), 2)
		self.assertEqual(parsed["assemblies"][0]["components"][1]["source_part_no"], "PART-002")

	def test_parse_part_number_description_sheet(self):
		path = self.make_workbook([
			["FG"],
			[None, "Item Code", "UOM"],
			[None, "FG-001", "Nos"],
			[],
			["ITEM NO.", "PART NUMBER.", "", "PART DESCRIPTION", "DESCRIPTION", "UOM", "Sheet Metal Thickness", "Mass", "QTY.", "GROSS WEIGHT"],
			[1, "SKIRTING ASM", "", "SKIRTING ASM", "SUB ASSY", "Nos", "", "", 1, ""],
			[None, "PANEL-001", "RM-001", "FRONT SKIRTING PANEL", "Sheet", "Kg", 1, 2.03, 2, 2.62],
		])

		parsed = dri._parse_bom_workbook(path, "FG-001")

		self.assertEqual(parsed["assemblies"][0]["source_part_no"], "SKIRTING ASM")
		self.assertEqual(parsed["assemblies"][0]["part_name"], "SKIRTING ASM")
		self.assertEqual(parsed["assemblies"][0]["components"][0]["part_name"], "FRONT SKIRTING PANEL")
		self.assertEqual(parsed["assemblies"][0]["components"][0]["erp_item_code"], "RM-001")
		self.assertEqual(parsed["assemblies"][0]["components"][0]["gross_weight"], 2.62)

	def test_nested_assembly_graph_uses_exact_part_number(self):
		parsed = {
			"assemblies": [
				{"source_part_no": "MAIN", "components": [{"source_part_no": "LEG"}, {"source_part_no": "TOP"}]},
				{"source_part_no": "LEG", "components": [{"source_part_no": "TUBE"}]},
			]
		}

		graph = dri._build_dependency_graph(parsed)

		self.assertEqual(graph["MAIN"], {"LEG"})
		self.assertEqual(graph["LEG"], set())

	def test_missing_child_items_created_using_existing_insert_path(self):
		design_item = SimpleNamespace(item_code="SRC-001", new_item_code="FG-001", uom="Nos")
		parsed = {
			"assemblies": [
				{
					"source_part_no": "SA-001",
					"part_name": "LEG TUBE ASM",
					"uom": "Nos",
					"components": [{"source_part_no": "PART-001", "part_name": "LEG TUBE", "uom": "Nos"}],
				}
			]
		}

		with patch.object(dri, "_find_mapped_item", return_value=None), \
			patch.object(dri, "_find_existing_item", return_value=None), \
			patch.object(dri.frappe, "has_permission", return_value=True), \
			patch.object(dri, "_create_missing_item", side_effect=["ITEM-SA", "ITEM-PART"]):
			source_to_item, summary = dri._resolve_or_create_items(design_item, parsed)

		self.assertEqual(source_to_item["SA-001"], "ITEM-SA")
		self.assertEqual(source_to_item["PART-001"], "ITEM-PART")
		self.assertEqual(summary["created"], ["ITEM-SA", "ITEM-PART"])

	def test_existing_child_items_reused(self):
		design_item = SimpleNamespace(item_code="SRC-001", new_item_code="FG-001", uom="Nos")
		parsed = {
			"assemblies": [
				{
					"source_part_no": "SA-001",
					"part_name": "LEG TUBE ASM",
					"uom": "Nos",
					"components": [{"source_part_no": "PART-001", "part_name": "LEG TUBE", "uom": "Nos"}],
				}
			]
		}

		with patch.object(dri, "_find_mapped_item", return_value=None), \
			patch.object(dri, "_find_existing_item", side_effect=["SA-001", "PART-001"]):
			source_to_item, summary = dri._resolve_or_create_items(design_item, parsed)

		self.assertEqual(source_to_item["SA-001"], "SA-001")
		self.assertEqual(source_to_item["PART-001"], "PART-001")
		self.assertEqual(summary["reused"], ["SA-001", "PART-001"])

	def test_child_bom_created_before_parent_and_fg(self):
		design_item = SimpleNamespace(item_code="SRC-001", new_item_code="FG-001", company="Test Company")
		parsed = {
			"assemblies": [
				{
					"source_part_no": "MAIN",
					"qty_in_fg": 1,
					"uom": "Nos",
					"components": [{"source_part_no": "LEG", "qty": 2, "uom": "Nos", "source_row": 2}],
				},
				{
					"source_part_no": "LEG",
					"qty_in_fg": 1,
					"uom": "Nos",
					"components": [{"source_part_no": "TUBE", "qty": 1, "uom": "Nos", "source_row": 4}],
				},
			]
		}
		source_to_item = {"MAIN": "ITEM-MAIN", "LEG": "ITEM-LEG", "TUBE": "ITEM-TUBE"}
		created_for = []

		def fake_bom(item_code, company, quantity, rows, is_default=0):
			created_for.append(item_code)
			return f"BOM-{item_code}", False

		with patch.object(dri, "_get_default_bom", return_value=None), \
			patch.object(dri, "_make_bom_row", side_effect=lambda item, qty, uom, child, row: {"item_code": item, "qty": qty, "uom": uom, "bom_no": child}), \
			patch.object(dri, "_get_or_create_submitted_bom", side_effect=fake_bom):
			assembly_boms, summary = dri._create_bom_hierarchy(design_item, parsed, source_to_item)

		self.assertEqual(created_for, ["ITEM-LEG", "ITEM-MAIN", "FG-001"])
		self.assertEqual(assembly_boms["__fg__"], "BOM-FG-001")
		self.assertIn("BOM-FG-001", summary["created"])

	def test_sheet_rows_create_child_boms_from_mapped_raw_material(self):
		design_item = SimpleNamespace(item_code="SRC-001", new_item_code="FG-001", company="Test Company")
		parsed = {
			"assemblies": [
				{
					"source_part_no": "MAIN",
					"qty_in_fg": 1,
					"uom": "Nos",
					"components": [
						{
							"source_part_no": "PANEL-1",
							"part_name": "Front Panel",
							"row_type": "Sheet",
							"sheet_metal_thickness": "1",
							"material": "AISI430 #4",
							"qty": 2,
							"uom": "Kg",
							"mass": 2.03,
							"gross_weight": 2.62,
							"raw_material_item_code": "RM-SHEET-1MM",
							"source_row": 2,
						},
						{
							"source_part_no": "PANEL-2",
							"part_name": "Side Panel",
							"row_type": "Sheet",
							"sheet_metal_thickness": "1",
							"material": "AISI430 #4",
							"qty": 2,
							"uom": "Kg",
							"mass": 0.95,
							"gross_weight": 1.243,
							"raw_material_item_code": "RM-SHEET-1MM",
							"source_row": 3,
						},
					],
				}
			]
		}
		captured_rows = {}
		created_for = []

		def fake_bom(item_code, company, quantity, rows, is_default=0):
			created_for.append(item_code)
			captured_rows[item_code] = rows
			return f"BOM-{item_code}", False

		source_to_item = {"MAIN": "ITEM-MAIN", "PANEL-1": "SF-PANEL-1", "PANEL-2": "SF-PANEL-2"}
		with patch.object(dri, "_get_default_bom", return_value=None), \
			patch.object(dri.frappe, "db", SimpleNamespace(get_value=lambda *args, **kwargs: "Kg")), \
			patch.object(dri, "_make_bom_row", side_effect=lambda item, qty, uom, child, row: {"item_code": item, "qty": qty, "uom": uom, "stock_uom": uom, "conversion_factor": 1, "bom_no": child}), \
			patch.object(dri, "_get_or_create_submitted_bom", side_effect=fake_bom):
			dri._create_bom_hierarchy(design_item, parsed, source_to_item)

		self.assertEqual(created_for, ["SF-PANEL-1", "SF-PANEL-2", "ITEM-MAIN", "FG-001"])
		self.assertEqual(captured_rows["SF-PANEL-1"][0]["item_code"], "RM-SHEET-1MM")
		self.assertAlmostEqual(captured_rows["SF-PANEL-1"][0]["qty"], 2.62)
		self.assertEqual(captured_rows["ITEM-MAIN"][0]["item_code"], "SF-PANEL-1")
		self.assertEqual(captured_rows["ITEM-MAIN"][0]["bom_no"], "BOM-SF-PANEL-1")

	def test_final_fg_bom_signature_links_to_design_item_code(self):
		row = dri._bom_signature([{"item_code": "FG-001", "qty": 1, "uom": "Nos", "bom_no": "BOM-SA"}])

		self.assertEqual(row, [("FG-001", 1.0, "Nos", "BOM-SA")])
